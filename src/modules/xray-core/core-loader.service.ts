import { chmod, readFile, readlink, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import prettyBytes from 'pretty-bytes';
import { z } from 'zod';

import { Injectable, Logger } from '@nestjs/common';

import { downloadFile } from '@common/utils/download-file';
import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';
import { readCoreVersion } from '@common/utils/read-core-version';

const CORE_LINK = '/usr/local/bin/rw-core';
const CORE_STOCK = '/usr/local/bin/xray';
const CORE_CUSTOM = '/usr/local/bin/xray-custom';
const CORE_STAGED = `${CORE_CUSTOM}.staged`;
const CORE_MARKER = '/usr/local/bin/.rw-core.json';

const TOTAL_TIMEOUT_MS = 15_000;

const CoreSchema = z.object({
    core: z
        .object({
            url: z.url({ protocol: /^https$/ }),
            sha256: z.hash('sha256').transform((value) => value.toLowerCase()),
        })
        .optional(),
});

type ICore = NonNullable<z.infer<typeof CoreSchema>['core']>;

interface ICoreMarker {
    url: string;
    sha256: string;
    size: number;
    mtimeMs: number;
    version: string;
    installedAt: string;
}

@Injectable()
export class CoreLoaderService {
    private readonly logger = new Logger(CoreLoaderService.name);

    public async prepare(geodata: unknown): Promise<void> {
        const parsed = CoreSchema.safeParse(geodata ?? {});

        if (!parsed.success) {
            this.logger.warn(
                `Invalid "core" section, skipped: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.')} ${issue.message}`)
                    .join('; ')}`,
            );
            return;
        }

        const { core } = parsed.data;

        if (!core) {
            await this.restoreStock();
            return;
        }

        if (await this.isInstalled(core)) return;

        await this.install(core);
    }

    private async isInstalled(core: ICore): Promise<boolean> {
        try {
            const marker = JSON.parse(await readFile(CORE_MARKER, 'utf8')) as ICoreMarker;

            if (marker.url !== core.url) {
                this.logger.log('Configured url changed, re-downloading.');
                return false;
            }

            if (marker.sha256 !== core.sha256) {
                this.logger.log('Configured sha256 changed, re-downloading.');
                return false;
            }

            const stats = await stat(CORE_CUSTOM);

            if (stats.size !== marker.size || stats.mtimeMs !== marker.mtimeMs) {
                this.logger.warn('Installed binary no longer matches the marker.');
                return false;
            }

            return (await readlink(CORE_LINK).catch(() => null)) === CORE_CUSTOM;
        } catch {
            return false;
        }
    }

    private async install(core: ICore): Promise<void> {
        const ct = getTime();

        try {
            const { sha256, size } = await downloadFile(core.url, CORE_STAGED, {
                totalTimeoutMs: TOTAL_TIMEOUT_MS,
                expectedSha256: core.sha256,
            });

            await chmod(CORE_STAGED, 0o755);

            const { raw: version } = await readCoreVersion(CORE_STAGED);

            await rename(CORE_STAGED, CORE_CUSTOM);
            await this.pointLinkAt(CORE_CUSTOM);

            const stats = await stat(CORE_CUSTOM);

            await this.writeMarker({
                url: core.url,
                sha256,
                size: stats.size,
                mtimeMs: stats.mtimeMs,
                version,
                installedAt: new Date().toISOString(),
            });

            this.logger.log(
                `Installed "${version}" (${prettyBytes(size)}) in ${formatExecutionTime(ct)}`,
            );
        } catch (error) {
            this.logger.error(`Failed to install custom core: ${error}`);

            await rm(CORE_STAGED, { force: true }).catch(() => void 0);
        }
    }

    private async restoreStock(): Promise<void> {
        const current = await readlink(CORE_LINK).catch(() => null);

        if (current === null || current === CORE_STOCK) return;

        await this.pointLinkAt(CORE_STOCK);
        await rm(CORE_MARKER, { force: true }).catch(() => void 0);
        await rm(CORE_CUSTOM, { force: true }).catch(() => void 0);

        this.logger.warn('No core configured, rolled back to the bundled one.');
    }

    private async pointLinkAt(target: string): Promise<void> {
        const tmpLink = `${CORE_LINK}.tmp`;

        await rm(tmpLink, { force: true });
        await symlink(target, tmpLink);
        await rename(tmpLink, CORE_LINK);
    }

    private async writeMarker(marker: ICoreMarker): Promise<void> {
        await writeFile(CORE_MARKER, JSON.stringify(marker, null, 2));
    }
}
