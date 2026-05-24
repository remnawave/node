import aws4 from 'aws4';
import { Agent, request } from 'undici';

import { Injectable, Logger } from '@nestjs/common';

import { IPakCreateResult, IPakProvider, PakProviderConflictError } from './pak-provider.interface';
import { probeS3Credentials } from './s3-probe.helper';

// Selectel IAM-backed PAK provider. Per-user prefix isolation against
// Selectel S3 is achieved by:
//   1. creating one IAM service user per (panel-user, inbound) pair, named
//      with the caller's `<userUuid>-<sha1(inboundTag).slice(0,8)>` handle,
//   2. issuing S3 credentials on that service user — the credentials
//      themselves bind to the service user, but Selectel's `s3.user` role
//      grants access to all buckets in the project, so step 3 is required
//      for true per-prefix isolation,
//   3. maintaining a bucket policy with one explicit per-user statement:
//        Principal: { AWS: [ <service-user-uuid> ] }
//        Resource: arn:aws:s3:::<bucket>/<basePrefix>/<userName>/*
//      This is the ONLY shape Selectel actually honours (see "Selectel
//      quirks" below). The 20 KB policy size ceiling caps the bucket at
//      roughly 100–150 active users — same scaling profile as VK Cloud PAK.
//
// Selectel quirks confirmed against vlt-test on s3.ru-1.storage.selcloud.ru
// (probes in /tmp/sel-policy-probe.mjs and /tmp/sel-principal-probe.mjs):
//   * Virtual-hosted-style requests return NoSuchBucket — must use
//     path-style (`https://<endpoint>/<bucket>/...`).
//   * `GET ?policy` returns 403 even for the master S3 keypair, so policy
//     state lives in `<bucket>/<STATE_KEY_PREFIX>/<basePrefix>.json`
//     written with the master S3 keys.
//   * `${aws:username}` does NOT expand in Resource, `aws:username`
//     Condition is NOT populated, and `arn:aws:iam::<account>:user/<name>`
//     Principal does NOT match Selectel IAM service users. The only
//     Principal form that grants access is the service user's UUID:
//     `Principal: { AWS: [ "<service_user_id>" ] }`.
//   * Bucket policy size limit is 20 KB; statements are ~200 B each, so
//     a bucket comfortably holds ~100 users. Multi-bucket / multi-inbound
//     sharding is the caller's responsibility.
//
// IAM API:    https://docs.selectel.ru/en/api/users-and-roles/
// Keystone:   https://docs.selectel.ru/en/api/authorization/
// Bucket pol: https://docs.selectel.ru/en/s3/buckets/bucket-policy/

const DEFAULT_IDENTITY_URL = 'https://cloud.api.selcloud.ru/identity/v3/auth/tokens';
const DEFAULT_IAM_API_URL = 'https://api.selectel.ru';
// Re-fetch the keystone token a few minutes before the 24h expiry to avoid a
// race between a long-running provision call and token expiration.
const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000;
// Where the JSON policy-state object lives inside the managed bucket. The
// path is intentionally outside the user-data namespace (`.fedarisha-…`)
// to avoid collisions with caller-owned objects.
const STATE_KEY_PREFIX = '.fedarisha-pak-state';
// Selectel rejects passwords without upper+lower+digit+special, min 8 chars
// (REQUEST_VALIDATION_FAILED / invalid_length_password). Service users
// never log in, but Selectel still demands a strong value at create time.
const PASSWORD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_SPECIAL = '!@#$%^&*';

export interface ISelectelPakStorage {
    bucket: string;
    endpoint: string;
    region: string;
    // Master S3 keys with bucket-policy write rights. Distinct from IAM
    // creds because PutBucketPolicy is a bucket-scoped S3 operation, while
    // service-user management goes through the IAM REST API.
    accessKey: string;
    secretKey: string;
    iam: ISelectelIamConfig;
    basePrefix: string;
    // Selectel rejects virtual-hosted-style on its regional endpoints, so
    // the adapter always operates in path-style.
    pathStyle?: boolean;
}

export interface ISelectelIamConfig {
    accountId: string;
    projectName: string;
    projectId: string;
    username: string;
    password: string;
    identityUrl?: string;
    apiUrl?: string;
}

interface IServiceUserRecord {
    id: string;
    name: string;
}

interface ICredentialRecord {
    name: string;
    access_key: string;
}

interface ITokenCacheEntry {
    token: string;
    expiresAt: number;
}

interface IPolicyMember {
    // IAM service user UUID. This is the only Principal form Selectel honours.
    serviceUserId: string;
    // Service user name; redundant with serviceUserId but kept so the state
    // file is human-readable and so we can rebuild the policy after
    // out-of-band manual fixes without re-querying IAM for every entry.
    userName: string;
    // Exact path-prefix the member is allowed to read/write under, taken
    // verbatim from the caller's `prefix` (basePrefix already stripped).
    keyPrefix: string;
}

interface IPolicyState {
    members: IPolicyMember[];
}

@Injectable()
export class SelectelPakService implements IPakProvider {
    public readonly type = 'selectel-iam';

    private readonly logger = new Logger(SelectelPakService.name);
    private readonly httpAgent = new Agent({ connectTimeout: 5_000 });

    private readonly tokenCache = new Map<string, ITokenCacheEntry>();

    public async createKey(
        storage: ISelectelPakStorage,
        userName: string,
        prefix: string,
    ): Promise<IPakCreateResult> {
        const keyPrefix = this.keyPrefixFromArgs(storage, prefix);

        const token = await this.getIamToken(storage.iam);
        const serviceUserId = await this.ensureServiceUser(storage.iam, token, userName);

        // Grant access BEFORE issuing creds, otherwise the brief window
        // between cred-issue and policy-update would surface as a 403 to
        // the user's first object PUT.
        await this.upsertPolicyMember(storage, { serviceUserId, userName, keyPrefix });

        // Selectel allows multiple S3 credentials per service user. Other
        // inbounds for the same user in the same account may already hold
        // creds; we only want to recreate ours, named after the caller's
        // (user, inbound) handle.
        await this.deleteCredentialsByName(storage.iam, token, serviceUserId, userName);

        try {
            const created = await this.createS3Credentials(
                storage.iam,
                token,
                serviceUserId,
                userName,
            );
            return {
                accessKey: created.accessKey,
                secretKey: created.secretKey,
                userName,
                prefix,
            };
        } catch (error) {
            if (this.isConflict(error)) {
                throw new PakProviderConflictError(this.type, userName);
            }
            throw error;
        }
    }

    public async deleteKey(
        storage: ISelectelPakStorage,
        userName: string,
        prefix: string,
    ): Promise<void> {
        const token = await this.getIamToken(storage.iam);
        const serviceUserId = await this.findServiceUser(storage.iam, token, userName);
        if (!serviceUserId) {
            // Service user is already gone — still scrub the stale policy
            // statement if it referenced this prefix, so the bucket doesn't
            // accumulate orphan grants.
            await this.removePolicyMemberByName(storage, userName);
            return;
        }

        await this.deleteCredentialsByName(storage.iam, token, serviceUserId, userName);

        // If no credentials remain we can safely drop the IAM user too —
        // leaving them around indefinitely would clutter the Selectel
        // account and eventually hit per-account user quotas. Other inbounds
        // for the same user will recreate the user on their next provision.
        const remaining = await this.listCredentials(storage.iam, token, serviceUserId);
        if (remaining.length === 0) {
            await this.removePolicyMember(storage, serviceUserId);
            await this.deleteServiceUser(storage.iam, token, serviceUserId);
        }
    }

    public async probeKey(
        storage: ISelectelPakStorage,
        accessKey: string,
        secretKey: string,
        prefix: string,
    ): Promise<boolean> {
        return probeS3Credentials(
            { ...storage, pathStyle: storage.pathStyle ?? true },
            accessKey,
            secretKey,
            prefix,
            this.httpAgent,
            this.logger,
        );
    }

    // The panel emits prefix as `<basePrefix>/<segment>/`. Strip the known
    // basePrefix and surrounding slashes so it can be used directly inside
    // the bucket-policy Resource ARN as a literal sub-path.
    private keyPrefixFromArgs(storage: ISelectelPakStorage, prefix: string): string {
        const trimmed = prefix.replace(/^\/+/, '').replace(/\/+$/, '');
        const base = storage.basePrefix.replace(/^\/+/, '').replace(/\/+$/, '');
        const head = base.length === 0 ? '' : `${base}/`;
        if (!trimmed.startsWith(head)) {
            throw new Error(
                `Selectel: prefix "${prefix}" does not start with configured basePrefix "${storage.basePrefix}"`,
            );
        }
        const tail = trimmed.slice(head.length);
        if (tail.length === 0) {
            throw new Error(
                `Selectel: prefix "${prefix}" must include at least one segment under basePrefix`,
            );
        }
        return `${head}${tail}`;
    }

    private async getIamToken(iam: ISelectelIamConfig): Promise<string> {
        const cacheKey = `${iam.accountId}:${iam.username}`;
        const cached = this.tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.token;

        const url = iam.identityUrl ?? DEFAULT_IDENTITY_URL;
        // IAM management endpoints (service users CRUD, credentials CRUD)
        // require an account/domain-scoped token; a project-scoped token
        // is rejected with 401 "X-Auth-Token is unauthorized". The project
        // is still implied per-call via the `project_id` body field.
        const body = JSON.stringify({
            auth: {
                identity: {
                    methods: ['password'],
                    password: {
                        user: {
                            name: iam.username,
                            domain: { name: iam.accountId },
                            password: iam.password,
                        },
                    },
                },
                scope: { domain: { name: iam.accountId } },
            },
        });

        const res = await request(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode !== 201) {
            throw new Error(`Selectel auth -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        const headerToken = res.headers['x-subject-token'];
        const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
        if (!token) {
            throw new Error('Selectel auth: missing X-Subject-Token header');
        }

        this.tokenCache.set(cacheKey, {
            token,
            expiresAt: Date.now() + TOKEN_LIFETIME_MS,
        });
        return token;
    }

    private async ensureServiceUser(
        iam: ISelectelIamConfig,
        token: string,
        userName: string,
    ): Promise<string> {
        const existing = await this.findServiceUser(iam, token, userName);
        if (existing) return existing;

        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const password = this.randomPassword();
        const res = await request(`${apiUrl}/iam/v1/service_users`, {
            method: 'POST',
            headers: this.iamHeaders(token),
            body: JSON.stringify({
                enabled: true,
                name: userName,
                password,
                // `object_storage:user` / `object_storage_user` are listed
                // in older docs but `/iam/v1/roles` reports them deprecated;
                // create requests with them fail with
                // "role '…' is not available for this user type".
                // `s3.user` is the active project-scoped S3 role and is what
                // the bucket policy then narrows by Principal + Resource.
                roles: [
                    {
                        project_id: iam.projectId,
                        role_name: 's3.user',
                        scope: 'project',
                    },
                ],
            }),
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();

        // Concurrent provisions can race the find→create window. A 409 here
        // means someone else just created the user we wanted; re-lookup is
        // the safe recovery, not a bubble-up.
        if (res.statusCode === 409) {
            const retry = await this.findServiceUser(iam, token, userName);
            if (retry) return retry;
            throw new Error(`Selectel create user 409 but lookup empty: ${text.slice(0, 200)}`);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel create user -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        const parsed = JSON.parse(text) as { id?: string };
        if (!parsed.id) throw new Error('Selectel create user: missing id in response');
        return parsed.id;
    }

    private async findServiceUser(
        iam: ISelectelIamConfig,
        token: string,
        userName: string,
    ): Promise<string | null> {
        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const res = await request(`${apiUrl}/iam/v1/service_users`, {
            method: 'GET',
            headers: this.iamHeaders(token),
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel list users -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        const parsed = JSON.parse(text) as { users?: IServiceUserRecord[] };
        const match = parsed.users?.find((u) => u.name === userName);
        return match?.id ?? null;
    }

    private async deleteServiceUser(
        iam: ISelectelIamConfig,
        token: string,
        userId: string,
    ): Promise<void> {
        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const res = await request(`${apiUrl}/iam/v1/service_users/${userId}`, {
            method: 'DELETE',
            headers: this.iamHeaders(token),
            dispatcher: this.httpAgent,
        });
        if (res.statusCode === 404) return;
        if (res.statusCode < 200 || res.statusCode >= 300) {
            const text = await res.body.text();
            throw new Error(`Selectel delete user -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        await res.body.text();
    }

    private async createS3Credentials(
        iam: ISelectelIamConfig,
        token: string,
        userId: string,
        name: string,
    ): Promise<{ accessKey: string; secretKey: string }> {
        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const res = await request(`${apiUrl}/iam/v1/service_users/${userId}/credentials`, {
            method: 'POST',
            headers: this.iamHeaders(token),
            body: JSON.stringify({ name, project_id: iam.projectId }),
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel create creds -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        const parsed = JSON.parse(text) as { access_key?: string; secret_key?: string };
        if (!parsed.access_key || !parsed.secret_key) {
            throw new Error(`Selectel create creds: missing keys in ${text.slice(0, 200)}`);
        }
        return { accessKey: parsed.access_key, secretKey: parsed.secret_key };
    }

    private async listCredentials(
        iam: ISelectelIamConfig,
        token: string,
        userId: string,
    ): Promise<ICredentialRecord[]> {
        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const res = await request(`${apiUrl}/iam/v1/service_users/${userId}/credentials`, {
            method: 'GET',
            headers: this.iamHeaders(token),
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode === 404) return [];
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel list creds -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        const parsed = JSON.parse(text) as { credentials?: ICredentialRecord[] };
        return parsed.credentials ?? [];
    }

    private async deleteCredentialsByName(
        iam: ISelectelIamConfig,
        token: string,
        userId: string,
        name: string,
    ): Promise<void> {
        const all = await this.listCredentials(iam, token, userId);
        const matching = all.filter((c) => c.name === name);
        for (const cred of matching) {
            await this.deleteCredential(iam, token, userId, cred.access_key);
        }
    }

    private async deleteCredential(
        iam: ISelectelIamConfig,
        token: string,
        userId: string,
        accessKey: string,
    ): Promise<void> {
        const apiUrl = iam.apiUrl ?? DEFAULT_IAM_API_URL;
        const res = await request(
            `${apiUrl}/iam/v1/service_users/${userId}/credentials/${encodeURIComponent(accessKey)}`,
            {
                method: 'DELETE',
                headers: this.iamHeaders(token),
                dispatcher: this.httpAgent,
            },
        );
        if (res.statusCode === 404) return;
        if (res.statusCode < 200 || res.statusCode >= 300) {
            const text = await res.body.text();
            throw new Error(`Selectel delete cred -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        await res.body.text();
    }

    // Add (or replace) a member entry, then rewrite the bucket policy from
    // the resulting member set. Selectel doesn't expose GetBucketPolicy to
    // any keypair we can hold, so the source of truth lives in an S3 state
    // object we write next to the policy under the same bucket. Two
    // concurrent provisions on different users race on this read-modify-
    // write; the loser's member can vanish until the next provision call
    // for that user re-adds it (createKey is the self-healing path).
    private async upsertPolicyMember(
        storage: ISelectelPakStorage,
        member: IPolicyMember,
    ): Promise<void> {
        const state = await this.readPolicyState(storage);
        const next = state.members.filter((m) => m.serviceUserId !== member.serviceUserId);
        next.push(member);
        await this.commitPolicy(storage, { members: next });
    }

    private async removePolicyMember(
        storage: ISelectelPakStorage,
        serviceUserId: string,
    ): Promise<void> {
        const state = await this.readPolicyState(storage);
        const next = state.members.filter((m) => m.serviceUserId !== serviceUserId);
        if (next.length === state.members.length) return;
        await this.commitPolicy(storage, { members: next });
    }

    private async removePolicyMemberByName(
        storage: ISelectelPakStorage,
        userName: string,
    ): Promise<void> {
        const state = await this.readPolicyState(storage);
        const next = state.members.filter((m) => m.userName !== userName);
        if (next.length === state.members.length) return;
        await this.commitPolicy(storage, { members: next });
    }

    private async commitPolicy(
        storage: ISelectelPakStorage,
        state: IPolicyState,
    ): Promise<void> {
        await this.writePolicyState(storage, state);
        const policy = this.buildPolicy(storage, state.members);
        await this.putBucketPolicy(storage, policy);
        this.logger.log(
            `Selectel: bucket policy on ${storage.bucket} now has ${state.members.length} member(s)`,
        );
    }

    private buildPolicy(storage: ISelectelPakStorage, members: IPolicyMember[]): IBucketPolicy {
        // Selectel's bucket policy is default-deny FOR ALL principals — once
        // any policy is attached, even the master S3 keypair loses access to
        // anything not explicitly allowed. We therefore always include a
        // statement that grants `*` access to the state-file path so the
        // next read-modify-write cycle (which runs with master keys) can
        // still find the state object. The exposure is intentional and
        // small: the state file contains service-user UUIDs and prefix
        // labels but no credentials.
        const statements: IPolicyStatement[] = [this.stateAccessStatement(storage)];
        if (members.length === 0) {
            statements.push(this.placeholderStatement(storage));
        } else {
            for (const m of members) statements.push(this.buildStatement(storage, m));
        }
        return { Version: '2012-10-17', Statement: statements };
    }

    private stateAccessStatement(storage: ISelectelPakStorage): IPolicyStatement {
        return {
            Sid: 'fedarisha-pak-state-access',
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            Resource: [`arn:aws:s3:::${storage.bucket}/${STATE_KEY_PREFIX}/*`],
        };
    }

    private buildStatement(
        storage: ISelectelPakStorage,
        member: IPolicyMember,
    ): IPolicyStatement {
        return {
            Sid: this.sidFor(member.serviceUserId),
            Effect: 'Allow',
            Principal: { AWS: [member.serviceUserId] },
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            Resource: [`arn:aws:s3:::${storage.bucket}/${member.keyPrefix}/*`],
        };
    }

    private placeholderStatement(storage: ISelectelPakStorage): IPolicyStatement {
        return {
            Sid: 'fedarisha-pak-placeholder',
            Effect: 'Deny',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            // Path that cannot collide with real prefixes — basePrefix is
            // user-controlled but `.fedarisha-pak-placeholder` is not a
            // valid key segment anyone would emit.
            Resource: [`arn:aws:s3:::${storage.bucket}/.fedarisha-pak-placeholder`],
        };
    }

    private sidFor(serviceUserId: string): string {
        // Statement Sid must match [A-Za-z0-9]+; the UUID is already safe.
        return `u${serviceUserId.replace(/[^A-Za-z0-9]/g, '')}`;
    }

    private stateKey(storage: ISelectelPakStorage): string {
        const base = storage.basePrefix.replace(/^\/+|\/+$/g, '') || 'root';
        const safe = base.replace(/[^A-Za-z0-9._-]/g, '_');
        return `${STATE_KEY_PREFIX}/${safe}.json`;
    }

    private async readPolicyState(storage: ISelectelPakStorage): Promise<IPolicyState> {
        const host = this.bareHost(storage);
        const path = `/${storage.bucket}/${this.stateKey(storage)}`;
        const opts: aws4.Request = {
            host,
            method: 'GET',
            path,
            service: 's3',
            region: storage.region,
            headers: {},
        };
        aws4.sign(opts, { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey });
        const res = await request(`https://${host}${path}`, {
            method: 'GET',
            headers: opts.headers as Record<string, string>,
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode === 404) return { members: [] };
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel read state -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
        try {
            const parsed = JSON.parse(text) as Partial<IPolicyState>;
            return { members: Array.isArray(parsed.members) ? parsed.members : [] };
        } catch {
            this.logger.warn(
                `Selectel: state object ${path} is not valid JSON; rebuilding from empty`,
            );
            return { members: [] };
        }
    }

    private async writePolicyState(
        storage: ISelectelPakStorage,
        state: IPolicyState,
    ): Promise<void> {
        const host = this.bareHost(storage);
        const path = `/${storage.bucket}/${this.stateKey(storage)}`;
        const body = JSON.stringify(state);
        const opts: aws4.Request = {
            host,
            method: 'PUT',
            path,
            service: 's3',
            region: storage.region,
            headers: { 'content-type': 'application/json' },
            body,
        };
        aws4.sign(opts, { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey });
        const res = await request(`https://${host}${path}`, {
            method: 'PUT',
            headers: opts.headers as Record<string, string>,
            body,
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel write state -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
    }

    private async putBucketPolicy(
        storage: ISelectelPakStorage,
        policy: IBucketPolicy,
    ): Promise<void> {
        const host = this.bareHost(storage);
        const path = `/${storage.bucket}/?policy`;
        const body = JSON.stringify(policy);
        const opts: aws4.Request = {
            host,
            method: 'PUT',
            path,
            service: 's3',
            region: storage.region,
            headers: { 'content-type': 'application/json' },
            body,
        };
        aws4.sign(opts, { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey });

        const res = await request(`https://${host}${path}`, {
            method: 'PUT',
            headers: opts.headers as Record<string, string>,
            body,
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Selectel put policy -> ${res.statusCode} ${text.slice(0, 200)}`);
        }
    }

    private bareHost(storage: ISelectelPakStorage): string {
        return storage.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }

    private iamHeaders(token: string): Record<string, string> {
        return {
            'x-auth-token': token,
            'content-type': 'application/json',
            accept: 'application/json',
        };
    }

    private isConflict(error: unknown): boolean {
        if (!(error instanceof Error)) return false;
        return /\b409\b/.test(error.message) || /already exists/i.test(error.message);
    }

    private randomPassword(): string {
        // Selectel rejects passwords without upper+lower+digit+special chars
        // (REQUEST_VALIDATION_FAILED / invalid_length_password). The service
        // user never logs in interactively but the API still validates the
        // policy at create time. `A1a!` seeds the four required classes;
        // the rest is ~136 bits of entropy from the alphanumeric set.
        let out = 'A1a!';
        for (let i = 0; i < 24; i++) {
            out += PASSWORD_ALPHA[Math.floor(Math.random() * PASSWORD_ALPHA.length)];
        }
        out += PASSWORD_SPECIAL[Math.floor(Math.random() * PASSWORD_SPECIAL.length)];
        return out;
    }
}

interface IBucketPolicy {
    Version: string;
    Statement: IPolicyStatement[];
}

interface IPolicyStatement {
    Sid?: string;
    Effect: 'Allow' | 'Deny';
    Principal?: { AWS?: string[] };
    Action: string[];
    Resource: string | string[];
    Condition?: Record<string, Record<string, string | string[]>>;
}
