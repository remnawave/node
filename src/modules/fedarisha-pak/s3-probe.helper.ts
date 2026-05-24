import { randomUUID } from 'node:crypto';
import { Agent, request } from 'undici';
import * as aws4 from 'aws4';

import { Logger } from '@nestjs/common';

export interface IS3EndpointConfig {
    bucket: string;
    endpoint: string;
    region: string;
    // Some providers (Selectel hb.ru-1) reject virtual-hosted-style requests
    // and only respond to path-style (`https://<endpoint>/<bucket>/<key>`).
    // Default false preserves VK Cloud's virtual-host behaviour.
    pathStyle?: boolean;
}

// Active S3 rejection of user-supplied credentials — anything else is treated
// as an infra wobble and surfaces as a thrown error so callers don't drop a
// valid cached credential pair on a transient failure.
export class S3ProbeError extends Error {
    constructor(
        public readonly statusCode: number,
        text: string,
    ) {
        super(`S3 probe -> ${statusCode} ${text.slice(0, 200)}`);
        this.name = 'S3ProbeError';
    }
}

// Verify that an (accessKey, secretKey) pair is actually authorized for the
// given prefix by exercising the exact write/read/delete flow the transport
// uses. We do not rely on ListObjectsV2 because prefix-scoped credentials
// (VK Cloud PAK, Selectel ${aws:username}) often deny List while allowing
// object ops.
export async function probeS3Credentials(
    storage: IS3EndpointConfig,
    accessKey: string,
    secretKey: string,
    prefix: string,
    agent: Agent,
    logger?: Logger,
): Promise<boolean> {
    const normalizedPrefix = normalizeObjectPrefix(prefix);
    const probeKey = `${normalizedPrefix}.rw-pak-probe-${Date.now()}-${randomUUID()}`;
    const body = Buffer.alloc(0);
    let created = false;

    try {
        await dispatchObject(storage, 'PUT', probeKey, accessKey, secretKey, agent, body);
        created = true;
        await dispatchObject(storage, 'HEAD', probeKey, accessKey, secretKey, agent);
        return true;
    } catch (error) {
        if (isRejectedProbe(error)) return false;
        throw error;
    } finally {
        if (created) {
            try {
                await dispatchObject(storage, 'DELETE', probeKey, accessKey, secretKey, agent);
            } catch (error) {
                logger?.warn(`S3 probe cleanup failed: ${errorMessage(error)}`);
            }
        }
    }
}

function isRejectedProbe(error: unknown): boolean {
    return error instanceof S3ProbeError && (error.statusCode === 403 || error.statusCode === 404);
}

function normalizeObjectPrefix(prefix: string): string {
    const trimmed = prefix.replace(/^\/+/, '');
    return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function bareHost(storage: IS3EndpointConfig): string {
    return storage.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function requestTarget(storage: IS3EndpointConfig, key: string): { host: string; path: string } {
    const host = bareHost(storage);
    if (storage.pathStyle) {
        return { host, path: `/${storage.bucket}/${key}` };
    }
    return { host: `${storage.bucket}.${host}`, path: `/${key}` };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function dispatchObject(
    storage: IS3EndpointConfig,
    method: 'PUT' | 'HEAD' | 'DELETE',
    key: string,
    accessKey: string,
    secretKey: string,
    agent: Agent,
    body?: Buffer,
): Promise<string> {
    const { host, path } = requestTarget(storage, key);
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
        dispatcher: agent,
    });
    const text = method === 'HEAD' ? '' : await res.body.text();

    if (res.statusCode >= 200 && res.statusCode < 300) return text;

    throw new S3ProbeError(res.statusCode, text);
}
