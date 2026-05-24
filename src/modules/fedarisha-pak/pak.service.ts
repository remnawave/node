import { Agent, request } from 'undici';
import * as aws4 from 'aws4';

import { Injectable, Logger } from '@nestjs/common';

import { probeS3Credentials } from './s3-probe.helper';

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

    public async probeKey(
        storage: Pick<IPakStorage, 'bucket' | 'endpoint' | 'region'>,
        accessKey: string,
        secretKey: string,
        prefix: string,
    ): Promise<boolean> {
        return probeS3Credentials(
            storage,
            accessKey,
            secretKey,
            prefix,
            this.httpAgent,
            this.logger,
        );
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
