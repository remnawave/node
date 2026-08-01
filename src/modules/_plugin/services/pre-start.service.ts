import ems from 'enhanced-ms';
import { glob, lstat, unlink } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';

import { PluginStateService } from './plugin-state.service';

@Injectable()
export class PreStartService {
    private readonly logger = new Logger(PreStartService.name);

    private readonly GLOB_MAGIC = /[*?[\]]/;
    private readonly MAX_MATCHES_PER_PATTERN = 256;

    constructor(private readonly state: PluginStateService) {}

    public async run(): Promise<void> {
        if (!this.state.plugins.preStart) return;
        if (!this.state.preStart.isEnabled) return;

        const tm = performance.now();

        await this.cleanupSockets();

        this.logger.log(
            `[PRE-START] Stage completed in ${ems(performance.now() - tm, {
                extends: 'short',
                includeMs: true,
            })}`,
        );
    }

    private async cleanupSockets(): Promise<void> {
        const { enabled, files } = this.state.preStart.cleanupSocketsConfig;

        if (!enabled) return;
        if (files.length === 0) return;

        let removed = 0;

        try {
            for (const pattern of files) {
                for (const path of await this.resolvePattern(pattern)) {
                    if (await this.removeSocket(path)) {
                        removed++;
                    }
                }
            }

            this.logger.log(`[PRE-START] Cleanup Sockets: ${removed} stale socket(s) removed.`);
        } catch (error) {
            this.logger.error(
                `[PRE-START] Cleanup Sockets failed after ${removed} removed socket(s): ${error}`,
            );
        }
    }

    private async resolvePattern(pattern: string): Promise<string[]> {
        if (!this.GLOB_MAGIC.test(pattern)) {
            return [pattern];
        }

        const matches: string[] = [];

        try {
            for await (const match of glob(pattern)) {
                if (matches.length >= this.MAX_MATCHES_PER_PATTERN) {
                    this.logger.warn(
                        `[PRE-START] Cleanup Sockets: pattern "${pattern}" matched more than ${this.MAX_MATCHES_PER_PATTERN} entries, the rest is skipped.`,
                    );
                    break;
                }

                matches.push(match);
            }
        } catch (error) {
            this.logger.warn(
                `[PRE-START] Cleanup Sockets: failed to expand pattern "${pattern}": ${error}`,
            );
        }

        return matches;
    }

    private async removeSocket(path: string): Promise<boolean> {
        try {
            const stats = await lstat(path);

            if (!stats.isSocket()) {
                this.logger.debug(
                    `[PRE-START] Cleanup Sockets: "${path}" is not a socket, skipped.`,
                );
                return false;
            }

            await unlink(path);

            this.logger.log(`[PRE-START] Cleanup Sockets: removed stale socket "${path}".`);

            return true;
        } catch (error) {
            if (this.isNotFound(error)) return false;

            this.logger.warn(`[PRE-START] Cleanup Sockets: failed to remove "${path}": ${error}`);

            return false;
        }
    }

    private isNotFound(error: unknown): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as NodeJS.ErrnoException).code === 'ENOENT'
        );
    }
}
