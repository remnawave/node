import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { TWarpStatus } from '@libs/contracts/models';

import { Injectable, Logger } from '@nestjs/common';

import { TWarpCommandResult } from './warp.types';

const execFileAsync = promisify(execFile);

const WARP_INTERFACE = 'warp';
const WARP_CONFIG_PATH = '/etc/wireguard/warp.conf';
const WARP_TRACE_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
const WARP_INSTALL_URL = 'https://raw.githubusercontent.com/distillium/warp-native/main/install.sh';
const WARP_EXEC_MAX_BUFFER = 16 * 1024 * 1024;

type TWarpTrace = {
    ip: string | null;
    warp: TWarpStatus['warp'];
    colo: string | null;
};

@Injectable()
export class WarpService {
    private readonly logger = new Logger(WarpService.name);

    public async getStatus(lastError: string | null = null): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.status({ lastError: lastError ?? 'WARP is supported only on Linux nodes' });
        }

        const running = await this.isInterfaceRunning();
        const installed = this.hasWarpConfig() || running;
        const hasWireGuardHandshake = running ? await this.hasWireGuardHandshake() : false;
        const trace = running ? await this.getTrace() : null;

        return this.status({
            installed,
            running,
            interfaceName: running ? WARP_INTERFACE : null,
            publicIp: trace?.ip ?? null,
            warp: this.getEffectiveWarpState(running, hasWireGuardHandshake, trace),
            colo: trace?.colo ?? null,
            lastError,
        });
    }

    public async enable(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        if (await this.isInterfaceRunning()) {
            return this.getStatus();
        }

        const permissionError = await this.getPermissionError();
        if (permissionError) {
            return this.getStatus(permissionError);
        }

        try {
            await this.installIfMissing();
            await this.execFixed('/usr/bin/wg-quick', ['up', WARP_INTERFACE], 20_000);
            return await this.getStatus();
        } catch (error) {
            const message = this.toSafeError(error);
            this.logger.warn(`Failed to enable WARP: ${message}`);
            return this.getStatus(message);
        }
    }

    public async disable(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        try {
            if (!(await this.isInterfaceRunning())) {
                return await this.getStatus();
            }

            if (this.hasWarpConfig()) {
                await this.execFixed('/usr/bin/wg-quick', ['down', WARP_INTERFACE], 20_000);
            } else {
                await this.deleteInterface();
            }

            return await this.getStatus();
        } catch (error) {
            try {
                await this.deleteInterface();
                return await this.getStatus();
            } catch (fallbackError) {
                const message = `${this.toSafeError(error)}; fallback delete failed: ${this.toSafeError(fallbackError)}`;
                this.logger.warn(`Failed to disable WARP: ${message}`);
                return this.getStatus(message);
            }
        }
    }

    private getEffectiveWarpState(
        running: boolean,
        hasWireGuardHandshake: boolean,
        trace: TWarpTrace | null,
    ): TWarpStatus['warp'] {
        if (!running) return 'off';
        if (hasWireGuardHandshake || trace?.warp === 'on') return 'on';
        if (trace?.warp === 'off') return 'unknown';

        return trace?.warp ?? 'unknown';
    }

    private async deleteInterface(): Promise<void> {
        const errors: string[] = [];

        for (const command of ['/sbin/ip', '/usr/sbin/ip']) {
            try {
                await this.execFixed(command, ['link', 'delete', WARP_INTERFACE], 20_000);
                return;
            } catch (error) {
                errors.push(`${command}: ${this.toSafeError(error)}`);
            }
        }

        throw new Error(errors.join('; '));
    }

    private async hasWireGuardHandshake(): Promise<boolean> {
        try {
            const result = await this.execFixed(
                '/usr/bin/wg',
                ['show', WARP_INTERFACE, 'latest-handshakes'],
                5_000,
            );

            return result.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .some((line) => {
                    const [, timestamp] = line.split(/\s+/);
                    return Number(timestamp) > 0;
                });
        } catch {
            return false;
        }
    }

    private async installIfMissing(): Promise<void> {
        if (this.hasWarpConfig() || (await this.isInterfaceRunning())) return;

        await this.ensureAlpinePackages();
        await this.execFixed('/bin/sh', ['-c', `curl -fsSL ${WARP_INSTALL_URL} | bash`], 180_000);
    }

    private async ensureAlpinePackages(): Promise<void> {
        if (!existsSync('/sbin/apk')) return;

        await this.execFixed(
            '/sbin/apk',
            ['add', '--no-cache', 'bash', 'curl', 'iproute2', 'openresolv', 'wireguard-tools'],
            120_000,
        );
    }

    private hasWarpConfig(): boolean {
        return existsSync(WARP_CONFIG_PATH);
    }

    private async isInterfaceRunning(): Promise<boolean> {
        try {
            await this.execFixed('/sbin/ip', ['link', 'show', WARP_INTERFACE], 5_000);
            return true;
        } catch {
            try {
                await this.execFixed('/usr/sbin/ip', ['link', 'show', WARP_INTERFACE], 5_000);
                return true;
            } catch {
                return false;
            }
        }
    }

    private async getTrace(): Promise<TWarpTrace | null> {
        try {
            const result = await this.execFixed(
                '/usr/bin/curl',
                ['--max-time', '5', '-fsSL', WARP_TRACE_URL],
                8_000,
            );

            const fields = new Map(
                result.stdout
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                        const [key, ...value] = line.split('=');
                        return [key, value.join('=')] as const;
                    }),
            );

            const warp = fields.get('warp');
            return {
                ip: fields.get('ip') ?? null,
                warp: warp === 'on' || warp === 'off' ? warp : 'unknown',
                colo: fields.get('colo') ?? null,
            };
        } catch {
            return null;
        }
    }

    private async getPermissionError(): Promise<string | null> {
        if (!this.hasNetAdminCapability()) {
            return 'NET_ADMIN capability is required to manage WARP';
        }

        try {
            await this.execFixed('/sbin/ip', ['link'], 5_000);
            return null;
        } catch {
            try {
                await this.execFixed('/usr/sbin/ip', ['link'], 5_000);
                return null;
            } catch (error) {
                return `Cannot inspect network interfaces: ${this.toSafeError(error)}`;
            }
        }
    }

    private hasNetAdminCapability(): boolean {
        try {
            const status = readFileSync('/proc/self/status', 'utf8');
            const match = status.match(/^CapEff:\s*([0-9a-f]+)$/im);
            if (!match) return false;

            const effective = BigInt(`0x${match[1]}`);
            const capNetAdmin = BigInt(1) << BigInt(12);
            return (effective & capNetAdmin) !== BigInt(0);
        } catch {
            return false;
        }
    }

    private async execFixed(
        command: string,
        args: string[],
        timeout: number,
    ): Promise<TWarpCommandResult> {
        const result = await execFileAsync(command, args, {
            encoding: 'utf8',
            timeout,
            maxBuffer: WARP_EXEC_MAX_BUFFER,
        });

        return {
            stdout: String(result.stdout ?? ''),
            stderr: String(result.stderr ?? ''),
        };
    }

    private status(partial: Partial<TWarpStatus>): TWarpStatus {
        return {
            installed: false,
            running: false,
            interfaceName: null,
            publicIp: null,
            warp: 'unknown',
            colo: null,
            lastError: null,
            ...partial,
        };
    }

    private toSafeError(error: unknown): string {
        if (error instanceof Error) {
            return this.limitOutput(error.message);
        }

        return this.limitOutput(String(error));
    }

    private limitOutput(value: string): string {
        return value.replaceAll(WARP_INSTALL_URL, '[warp-install-url]').slice(0, 500);
    }
}
