import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import ems from 'enhanced-ms';
import { createWriteStream } from 'node:fs';
import { open, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pMap from 'p-map';
import prettyBytes from 'pretty-bytes';
import { z } from 'zod';

import { Injectable, Logger } from '@nestjs/common';

const ASSETS_DIR = resolve(process.env.XRAY_LOCATION_ASSET || '/usr/local/share/xray');
const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 15_000;
const MAX_ASSET_SIZE = 128 * 1024 * 1024;
const CONCURRENCY = 5;

const FILE_NAME_REGEX = /^(?!\.{1,2}$)[\w.-]+$/;

const GeodataSchema = z.object({
    assets: z
        .array(
            z.object({
                url: z.url({ protocol: /^https$/ }),
                file: z
                    .string()
                    .regex(
                        FILE_NAME_REGEX,
                        'must be a file name without a path, e.g. "geoip-custom.dat"',
                    ),
            }),
        )
        .default([]),
});

type IGeodataAsset = z.infer<typeof GeodataSchema>['assets'][number];

const elapsed = (since: number): string =>
    ems(performance.now() - since, { extends: 'short', includeMs: true, includeSubMs: true }) ??
    '0ms';

@Injectable()
export class GeodataService {
    private readonly logger = new Logger(GeodataService.name);

    public async prepareAssets(config: Record<string, unknown>): Promise<void> {
        if (config.geodata === undefined) return;

        const parsed = GeodataSchema.safeParse(config.geodata);

        if (!parsed.success) {
            this.logger.warn(
                `[GEODATA] Invalid "geodata" section, skipped: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                    .join('; ')}`,
            );
            return;
        }

        const { assets } = parsed.data;

        if (assets.length === 0) return;

        const tm = performance.now();

        await pMap(assets, (asset) => this.prepareAsset(asset), { concurrency: CONCURRENCY });

        this.logger.log(`[GEODATA] ${assets.length} asset(s) processed in ${elapsed(tm)}`);
    }

    private async prepareAsset(asset: IGeodataAsset): Promise<void> {
        const path = join(ASSETS_DIR, asset.file);

        if (await this.exists(path)) return;

        if (await this.download(asset.url, path)) return;

        await this.createStub(path);
    }

    private async exists(path: string): Promise<boolean> {
        try {
            const stats = await stat(path);

            return stats.isFile() && stats.size > 0;
        } catch {
            return false;
        }
    }

    private async createStub(path: string): Promise<void> {
        try {
            await (await open(path, 'wx')).close();

            this.logger.warn(`[GEODATA] Created empty stub asset "${path}".`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;

            this.logger.error(`[GEODATA] Failed to create stub asset "${path}": ${error}`);
        }
    }

    private async download(url: string, path: string): Promise<boolean> {
        const tmpPath = `${path}.download`;
        const tm = performance.now();

        const controller = new AbortController();

        const idle = setTimeout(
            () => controller.abort(new Error(`no data received for ${REQUEST_TIMEOUT_MS}ms`)),
            REQUEST_TIMEOUT_MS,
        );

        try {
            const response = await fetch(url, {
                redirect: 'follow',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(TOTAL_TIMEOUT_MS)]),
            });

            idle.refresh();

            if (!response.ok || !response.body) {
                throw new Error(`unexpected response ${response.status} ${response.statusText}`);
            }

            if (!response.url.startsWith('https:')) {
                throw new Error(`redirected to a non-https url "${response.url}"`);
            }

            if (Number(response.headers.get('content-length')) > MAX_ASSET_SIZE) {
                throw new Error(`content-length exceeds ${MAX_ASSET_SIZE} bytes`);
            }

            let downloaded = 0;

            await pipeline(
                Readable.fromWeb(response.body as NodeReadableStream),
                async function* (chunks) {
                    for await (const chunk of chunks) {
                        idle.refresh();

                        downloaded += chunk.length;

                        if (downloaded > MAX_ASSET_SIZE) {
                            throw new Error(`asset exceeds ${MAX_ASSET_SIZE} bytes`);
                        }

                        yield chunk;
                    }
                },
                createWriteStream(tmpPath),
            );

            if (downloaded === 0) throw new Error('empty response body');

            await rename(tmpPath, path);

            this.logger.log(
                `[GEODATA] Downloaded "${path}" (${prettyBytes(downloaded)}) in ${elapsed(tm)}`,
            );

            return true;
        } catch (error) {
            this.logger.error(`[GEODATA] Failed to download "${url}": ${error}`);

            await rm(tmpPath, { force: true }).catch(() => void 0);

            return false;
        } finally {
            clearTimeout(idle);
        }
    }
}
