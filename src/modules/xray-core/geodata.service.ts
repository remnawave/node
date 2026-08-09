import { open, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pMap from 'p-map';
import prettyBytes from 'pretty-bytes';
import { z } from 'zod';

import { Injectable, Logger } from '@nestjs/common';

import { downloadFile } from '@common/utils/download-file';
import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';

const ASSETS_DIR = resolve(process.env.XRAY_LOCATION_ASSET || '/usr/local/share/xray');
const TOTAL_TIMEOUT_MS = 15_000;
const CONCURRENCY = 5;

const FILE_NAME_REGEX = /^(?!\.{1,2}$)[\w.-]+$/;

const AssetsSchema = z.object({
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

type IGeodataAsset = z.infer<typeof AssetsSchema>['assets'][number];

@Injectable()
export class GeodataService {
    private readonly logger = new Logger(GeodataService.name);

    public async prepare(geodata: unknown): Promise<void> {
        if (geodata === undefined) return;

        const parsed = AssetsSchema.safeParse(geodata);

        if (!parsed.success) {
            this.logger.warn(
                `Invalid "assets" section, skipped: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                    .join('; ')}`,
            );
            return;
        }

        const { assets } = parsed.data;

        if (assets.length === 0) return;

        const ct = getTime();

        await pMap(assets, (asset) => this.prepareAsset(asset), { concurrency: CONCURRENCY });

        this.logger.log(`${assets.length} asset(s) processed in ${formatExecutionTime(ct)}`);
    }

    private async prepareAsset(asset: IGeodataAsset): Promise<void> {
        const path = join(ASSETS_DIR, asset.file);

        if (await this.exists(path)) return;

        if (await this.download(asset, path)) return;

        await this.createStub(path);
    }

    private async download(asset: IGeodataAsset, path: string): Promise<boolean> {
        const ct = getTime();

        try {
            const { size } = await downloadFile(asset.url, path, {
                totalTimeoutMs: TOTAL_TIMEOUT_MS,
            });

            this.logger.log(
                `Downloaded "${asset.file}" (${prettyBytes(size)}) in ${formatExecutionTime(ct)}`,
            );

            return true;
        } catch (error) {
            this.logger.error(`Failed to download "${asset.url}": ${error}`);

            return false;
        }
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

            this.logger.warn(`Created empty stub asset "${path}".`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;

            this.logger.error(`Failed to create stub asset "${path}": ${error}`);
        }
    }
}
