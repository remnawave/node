import { Agent, request } from 'undici';
import * as aws4 from 'aws4';
import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

// VK Cloud Storage Prefix Access Keys (PAK) API client.
// Issues per-user prefix-scoped S3 credentials against a single bucket using
// the master credentials carried in this node's runtime config.
// Spec: https://cloud.vk.com/docs/ru/tools-for-using-services/api/api-spec/s3-rest-api/pak-api

export interface IPakStorage {
    bucket: string;
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

export interface IPakCreateResult {
    accessKey: string;
    secretKey: string;
    userName: string;
    prefix: string;
}

// Thrown when VK Cloud refuses a PAK PUT because the username already exists
// on the bucket. Caller may delete the orphan and retry. This typically
// happens when the panel forgot the cached creds (DB wipe, manual meta
// reset) but the PAK was never revoked on VK Cloud.
export class PakUserAlreadyExistsError extends Error {
    constructor(public readonly userName: string) {
        super(`VK Cloud PAK already exists for user ${userName}`);
        this.name = 'PakUserAlreadyExistsError';
    }
}

@Injectable()
export class PakService {
    private readonly logger = new Logger(PakService.name);
    private readonly httpAgent = new Agent({ connectTimeout: 5_000 });

    public async createKey(
        storage: IPakStorage,
        userName: string,
        prefix: string,
    ): Promise<IPakCreateResult> {
        const body = await this.dispatch(storage, 'PUT', userName, prefix);
        return this.parseCreate(body);
    }

    public async deleteKey(storage: IPakStorage, userName: string, prefix: string): Promise<void> {
        await this.dispatch(storage, 'DELETE', userName, prefix);
    }

    // Test-call the bucket with user-supplied creds against their prefix.
    // Prefix-scoped VK Cloud keys may be denied ListObjectsV2 while still
    // being valid for the transport's object operations, so probe the same
    // write/read/delete flow the client needs. Returns false only when S3
    // actively rejects the creds/scope. Any other error is surfaced so the
    // panel does not invalidate a cached PAK on an infra wobble.
    public async probeKey(
        storage: Pick<IPakStorage, 'bucket' | 'endpoint' | 'region'>,
        accessKey: string,
        secretKey: string,
        prefix: string,
    ): Promise<boolean> {
        const normalizedPrefix = this.normalizeObjectPrefix(prefix);
        const probeKey = `${normalizedPrefix}.rw-pak-probe-${Date.now()}-${randomUUID()}`;
        const body = Buffer.alloc(0);
        let created = false;

        try {
            await this.dispatchObject(storage, 'PUT', probeKey, accessKey, secretKey, body);
            created = true;
            await this.dispatchObject(storage, 'HEAD', probeKey, accessKey, secretKey);

            return true;
        } catch (error) {
            if (this.isRejectedPakProbe(error)) return false;
            throw error;
        } finally {
            if (created) {
                try {
                    await this.dispatchObject(storage, 'DELETE', probeKey, accessKey, secretKey);
                } catch (error) {
                    this.logger.warn(`VK Cloud probe cleanup failed: ${this.errorMessage(error)}`);
                }
            }
        }
    }

    private normalizeObjectPrefix(prefix: string): string {
        const trimmed = prefix.replace(/^\/+/, '');
        return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    }

    private async dispatch(
        storage: IPakStorage,
        method: 'PUT' | 'DELETE',
        userName: string,
        prefix: string,
    ): Promise<string> {
        const host = this.virtualHost(storage);
        const query = `pak&username=${encodeURIComponent(userName)}&prefix=${encodeURIComponent(prefix)}`;
        const path = `/?${query}`;
        const url = `https://${host}${path}`;

        const opts: aws4.Request = {
            host,
            method,
            path,
            service: 's3',
            region: storage.region,
            headers: {},
        };
        aws4.sign(opts, { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey });

        const res = await request(url, {
            method,
            headers: opts.headers as Record<string, string>,
            dispatcher: this.httpAgent,
        });
        const text = await res.body.text();

        if (res.statusCode < 200 || res.statusCode >= 300) {
            if (method === 'PUT' && res.statusCode === 409 && /UserAlreadyExists/.test(text)) {
                throw new PakUserAlreadyExistsError(userName);
            }
            throw new Error(`VK Cloud PAK ${method} -> ${res.statusCode} ${text}`);
        }
        return text;
    }

    private async dispatchObject(
        storage: Pick<IPakStorage, 'bucket' | 'endpoint' | 'region'>,
        method: 'PUT' | 'HEAD' | 'DELETE',
        key: string,
        accessKey: string,
        secretKey: string,
        body?: Buffer,
    ): Promise<string> {
        const host = this.virtualHost(storage);
        const path = `/${key}`;
        const url = `https://${host}${path}`;

        const opts: aws4.Request = {
            host,
            method,
            path,
            service: 's3',
            region: storage.region,
            headers: {},
            body,
        };
        aws4.sign(opts, { accessKeyId: accessKey, secretAccessKey: secretKey });

        const res = await request(url, {
            method,
            headers: opts.headers as Record<string, string>,
            body,
            dispatcher: this.httpAgent,
        });
        const text = method === 'HEAD' ? '' : await res.body.text();

        if (res.statusCode >= 200 && res.statusCode < 300) return text;

        throw new PakProbeError(res.statusCode, text);
    }

    private isRejectedPakProbe(error: unknown): boolean {
        return (
            error instanceof PakProbeError && (error.statusCode === 403 || error.statusCode === 404)
        );
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private virtualHost(storage: Pick<IPakStorage, 'bucket' | 'endpoint'>): string {
        const stripped = storage.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${storage.bucket}.${stripped}`;
    }

    private parseCreate(xml: string): IPakCreateResult {
        const access = this.extract(xml, 'AccessKey');
        const secret = this.extract(xml, 'SecretKey');
        const user = this.extract(xml, 'UserName');
        const prefix = this.extract(xml, 'Prefix');
        if (!access || !secret) {
            throw new Error(`PAK response missing AccessKey/SecretKey: ${xml.slice(0, 200)}`);
        }
        return {
            accessKey: access,
            secretKey: secret,
            userName: user ?? '',
            prefix: prefix ?? '',
        };
    }

    private extract(xml: string, tag: string): string | null {
        const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
        const match = re.exec(xml);
        return match ? match[1].trim() : null;
    }
}

class PakProbeError extends Error {
    constructor(
        public readonly statusCode: number,
        text: string,
    ) {
        super(`VK Cloud probe -> ${statusCode} ${text.slice(0, 200)}`);
        this.name = 'PakProbeError';
    }
}
