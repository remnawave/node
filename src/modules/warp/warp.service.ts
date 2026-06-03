import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

import type { TWarpStatus } from '@libs/contracts/models';

import { Injectable, Logger } from '@nestjs/common';

import { TWarpCommandResult } from './warp.types';

const WARP_INTERFACE = 'warp';
const WARP_CONFIG_PATH = '/etc/wireguard/warp.conf';
const WARP_TRACE_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
const WGCF_RELEASES_API_URL = 'https://api.github.com/repos/ViRb3/wgcf/releases/latest';
const WARP_ENDPOINT = '162.159.192.1:2408';
const WARP_OUTPUT_TAIL_BYTES = 64 * 1024;
const WARP_KILL_GRACE_MS = 5_000;
const WARP_INSTALL_SCRIPT = String.raw`
set -euo pipefail

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|amd64) WGCF_ARCH="linux_amd64" ;;
    aarch64|arm64) WGCF_ARCH="linux_arm64" ;;
    armv7l|armv7) WGCF_ARCH="linux_armv7" ;;
    armv6l|armv6) WGCF_ARCH="linux_armv6" ;;
    armv5l|armv5) WGCF_ARCH="linux_armv5" ;;
    i386|i686) WGCF_ARCH="linux_386" ;;
    s390x) WGCF_ARCH="linux_s390x" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

if ! command -v wgcf >/dev/null 2>&1; then
    WGCF_URL="$(
        curl -fsSL ${WGCF_RELEASES_API_URL} \
            | grep -Eo 'https://[^"]+wgcf_[^"]+_'"$WGCF_ARCH"'"?' \
            | head -n 1 \
            | tr -d '"'
    )"

    if [ -z "$WGCF_URL" ]; then
        echo "Could not resolve wgcf download URL for $WGCF_ARCH" >&2
        exit 1
    fi

    curl -fsSL "$WGCF_URL" -o /usr/local/bin/wgcf
    chmod +x /usr/local/bin/wgcf
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

wgcf register --accept-tos >/dev/null
wgcf generate >/dev/null
test -s wgcf-profile.conf

sed -i -E '/^DNS =/d' wgcf-profile.conf
sed -i -E 's#^(Address = [^,]+),.*#\1#' wgcf-profile.conf
sed -i -E 's#^Endpoint = .*$#Endpoint = ${WARP_ENDPOINT}#' wgcf-profile.conf
grep -q '^Table = off$' wgcf-profile.conf || sed -i '/^MTU =/a Table = off' wgcf-profile.conf
grep -q '^PersistentKeepalive = ' wgcf-profile.conf \
    || sed -i '/^Endpoint =/a PersistentKeepalive = 25' wgcf-profile.conf

mkdir -p /etc/wireguard
install -m 600 wgcf-profile.conf ${WARP_CONFIG_PATH}
`;

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
            const currentStatus = await this.getStatus();
            if (currentStatus.warp === 'on') {
                return currentStatus;
            }
        }

        const permissionError = await this.getPermissionError();
        if (permissionError) {
            return this.getStatus(permissionError);
        }

        try {
            await this.installIfMissing();
            this.normalizeWarpConfig();
            await this.stopRunningInterface();
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

    private async stopRunningInterface(): Promise<void> {
        if (!(await this.isInterfaceRunning())) return;

        if (this.hasWarpConfig()) {
            await this.execFixed('/usr/bin/wg-quick', ['down', WARP_INTERFACE], 20_000);
            return;
        }

        await this.deleteInterface();
    }

    private normalizeWarpConfig(): void {
        if (!this.hasWarpConfig()) return;

        const original = readFileSync(WARP_CONFIG_PATH, 'utf8');
        let updated = original.replace(/^Endpoint = .*$/m, `Endpoint = ${WARP_ENDPOINT}`);

        if (!/^Table = off$/m.test(updated)) {
            updated = updated.replace(/^MTU = .*$/m, (line) => `${line}\nTable = off`);
        }

        if (!/^PersistentKeepalive = /m.test(updated)) {
            updated = updated.replace(
                /^Endpoint = .*$/m,
                (line) => `${line}\nPersistentKeepalive = 25`,
            );
        }

        if (updated !== original) {
            writeFileSync(WARP_CONFIG_PATH, updated, { mode: 0o600 });
        }
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
        await this.execFixed('/bin/bash', ['-o', 'pipefail', '-c', WARP_INSTALL_SCRIPT], 180_000);
    }

    private async ensureAlpinePackages(): Promise<void> {
        if (!existsSync('/sbin/apk')) return;

        await this.execFixed(
            '/sbin/apk',
            [
                'add',
                '--no-cache',
                'bash',
                'ca-certificates',
                'curl',
                'iproute2',
                'openresolv',
                'wireguard-tools',
            ],
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
                ['--max-time', '5', '-4', '--interface', WARP_INTERFACE, '-fsSL', WARP_TRACE_URL],
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
        return await new Promise<TWarpCommandResult>((resolve, reject) => {
            const child = spawn(command, args, {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let settled = false;
            let timedOut = false;
            let killTimer: NodeJS.Timeout | null = null;

            const timer = setTimeout(() => {
                timedOut = true;
                this.killProcessGroup(child.pid, 'SIGTERM');
                killTimer = setTimeout(() => {
                    this.killProcessGroup(child.pid, 'SIGKILL');
                }, WARP_KILL_GRACE_MS);
            }, timeout);

            const settle = (callback: () => void) => {
                if (settled) return;

                settled = true;
                clearTimeout(timer);
                if (killTimer) clearTimeout(killTimer);
                callback();
            };

            child.stdout?.on('data', (chunk: Buffer) => {
                stdout = this.appendOutputTail(stdout, chunk);
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                stderr = this.appendOutputTail(stderr, chunk);
            });

            child.on('error', (error) => {
                settle(() => reject(error));
            });

            child.on('close', (code, signal) => {
                settle(() => {
                    if (timedOut) {
                        reject(new Error(`${command} timed out after ${timeout}ms`));
                        return;
                    }

                    if (code === 0) {
                        resolve({ stdout, stderr });
                        return;
                    }

                    const details = [
                        `${command} exited with code ${code ?? 'null'}`,
                        signal ? `signal ${signal}` : null,
                        stderr.trim() ? `stderr: ${stderr.trim()}` : null,
                        stdout.trim() ? `stdout: ${stdout.trim()}` : null,
                    ].filter(Boolean);

                    reject(new Error(details.join('; ')));
                });
            });
        });
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
        return value.replaceAll(WGCF_RELEASES_API_URL, '[wgcf-releases-url]').slice(0, 500);
    }

    private appendOutputTail(current: string, chunk: Buffer): string {
        const next = `${current}${chunk.toString('utf8')}`;

        if (Buffer.byteLength(next, 'utf8') <= WARP_OUTPUT_TAIL_BYTES) {
            return next;
        }

        return next.slice(-WARP_OUTPUT_TAIL_BYTES);
    }

    private killProcessGroup(pid: number | undefined, signal: NodeJS.Signals): void {
        if (!pid) return;

        try {
            process.kill(-pid, signal);
        } catch {
            try {
                process.kill(pid, signal);
            } catch {
                // The process may already have exited.
            }
        }
    }
}
