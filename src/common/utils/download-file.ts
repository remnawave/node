import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const IDLE_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 15_000;
const MAX_SIZE = 128 * 1024 * 1024;

interface IDownloadOptions {
    idleTimeoutMs?: number;
    totalTimeoutMs?: number;
    maxSize?: number;
    expectedSha256?: string;
}

interface IDownloadResult {
    sha256: string;
    size: number;
}

export async function downloadFile(
    url: string,
    path: string,
    options: IDownloadOptions = {},
): Promise<IDownloadResult> {
    const {
        idleTimeoutMs = IDLE_TIMEOUT_MS,
        totalTimeoutMs = TOTAL_TIMEOUT_MS,
        maxSize = MAX_SIZE,
        expectedSha256,
    } = options;

    const tmpPath = `${path}.download`;
    const controller = new AbortController();

    const idle = setTimeout(
        () => controller.abort(new Error(`no data received for ${idleTimeoutMs}ms`)),
        idleTimeoutMs,
    );

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(totalTimeoutMs)]),
        });

        idle.refresh();

        if (!response.ok || !response.body) {
            throw new Error(`unexpected response ${response.status} ${response.statusText}`);
        }

        if (!response.url.startsWith('https:')) {
            throw new Error(`redirected to a non-https url "${response.url}"`);
        }

        if (Number(response.headers.get('content-length')) > maxSize) {
            throw new Error(`content-length exceeds ${maxSize} bytes`);
        }

        const digest = createHash('sha256');

        let size = 0;

        await pipeline(
            Readable.fromWeb(response.body as NodeReadableStream),
            async function* (chunks) {
                for await (const chunk of chunks) {
                    idle.refresh();

                    size += chunk.length;

                    if (size > maxSize) throw new Error(`body exceeds ${maxSize} bytes`);

                    digest.update(chunk);

                    yield chunk;
                }
            },
            createWriteStream(tmpPath),
        );

        if (size === 0) throw new Error('empty response body');

        const sha256 = digest.digest('hex');

        if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) {
            throw new Error(`sha256 mismatch, got ${sha256}, expected ${expectedSha256}`);
        }

        await rename(tmpPath, path);

        return { sha256, size };
    } catch (error) {
        await rm(tmpPath, { force: true }).catch(() => void 0);

        throw error;
    } finally {
        clearTimeout(idle);
    }
}
