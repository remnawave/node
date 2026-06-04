import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

import type { THostConnectivity, TWarpOperation, TWarpStatus } from '@libs/contracts/models';

import { Injectable, Logger } from '@nestjs/common';

import { TWarpCommandResult } from './warp.types';

const WARP_INTERFACE = 'warp';
const WARP_CONFIG_PATH = '/etc/wireguard/warp.conf';
const WARP_TOOL_PATH = '/usr/local/bin/wgcf';
const WARP_TRACE_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
const WGCF_RELEASES_API_URL = 'https://api.github.com/repos/ViRb3/wgcf/releases/latest';
const WARP_ENDPOINT = '162.159.192.1:2408';
const WARP_IPV6_ROUTE_METRIC = 4242;
const WARP_IPV6_ROUTE_POST_UP = `PostUp = ip -6 route replace ::/0 dev %i metric ${WARP_IPV6_ROUTE_METRIC}`;
const WARP_IPV6_ROUTE_PRE_DOWN = `PreDown = ip -6 route del ::/0 dev %i metric ${WARP_IPV6_ROUTE_METRIC} 2>/dev/null || true`;
const WARP_MANAGED_IPV6_ROUTE_LINES = [WARP_IPV6_ROUTE_POST_UP, WARP_IPV6_ROUTE_PRE_DOWN];
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
    echo "[warp] resolving latest wgcf release"
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

    echo "[warp] downloading wgcf"
    curl -fsSL "$WGCF_URL" -o ${WARP_TOOL_PATH}
    chmod +x ${WARP_TOOL_PATH}
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

echo "[warp] registering WARP account"
wgcf register --accept-tos >/dev/null
echo "[warp] updating WARP account"
wgcf update >/dev/null
echo "[warp] generating WireGuard profile"
wgcf generate >/dev/null
test -s wgcf-profile.conf

echo "[warp] normalizing WireGuard profile"
sed -i -E '/^DNS =/d' wgcf-profile.conf
sed -i -E 's#^Endpoint = .*$#Endpoint = ${WARP_ENDPOINT}#' wgcf-profile.conf
grep -q '^Table = off$' wgcf-profile.conf || sed -i '/^MTU =/a Table = off' wgcf-profile.conf
grep -q '^PersistentKeepalive = ' wgcf-profile.conf \
    || sed -i '/^Endpoint =/a PersistentKeepalive = 25' wgcf-profile.conf

mkdir -p /etc/wireguard
echo "[warp] installing WireGuard profile"
install -m 600 wgcf-profile.conf ${WARP_CONFIG_PATH}
`;

type TWarpTrace = {
    publicIp: string | null;
    warp: TWarpStatus['warp'];
    colo: string | null;
};

type TWarpTraceIpVersion = '4' | '6';
type TPublicIpProbe = {
    publicIp: string | null;
    reachable: boolean;
    lastError: string | null;
};
type TWarpOperationState = TWarpOperation['state'];

@Injectable()
export class WarpService {
    private readonly logger = new Logger(WarpService.name);
    private operation: TWarpOperation = this.createIdleOperation();

    public async getHostConnectivity(): Promise<THostConnectivity> {
        if (process.platform !== 'linux') {
            return this.hostConnectivity({
                lastError: 'Host connectivity probing is supported only on Linux nodes',
            });
        }

        const [ipv4, ipv6] = await Promise.all([
            this.getPublicIpProbe('4'),
            this.getPublicIpProbe('6'),
        ]);

        const lastError = [ipv4.lastError, ipv6.lastError].filter(Boolean).join('; ') || null;

        return this.hostConnectivity({
            publicIpv4: ipv4.publicIp,
            publicIpv6: ipv6.publicIp,
            supportsIpv4: ipv4.reachable,
            supportsIpv6: ipv6.reachable,
            ipv4,
            ipv6,
            lastError,
        });
    }

    public async getStatus(lastError: string | null = null): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.status({ lastError: lastError ?? 'WARP is supported only on Linux nodes' });
        }

        const running = await this.isInterfaceRunning();
        const installed = this.hasWarpConfig() || running;
        const hasWireGuardHandshake = running ? await this.hasWireGuardHandshake() : false;
        const traceIpv4 = running ? await this.getTrace('4') : null;
        const traceIpv6 = running ? await this.getTrace('6') : null;

        return this.status({
            installed,
            running,
            interfaceName: running ? WARP_INTERFACE : null,
            publicIp: traceIpv4?.publicIp ?? traceIpv6?.publicIp ?? null,
            publicIpv4: traceIpv4?.publicIp ?? null,
            publicIpv6: traceIpv6?.publicIp ?? null,
            warp: this.getEffectiveWarpState(running, hasWireGuardHandshake, traceIpv4, traceIpv6),
            colo: traceIpv4?.colo ?? traceIpv6?.colo ?? null,
            ipv4: traceIpv4,
            ipv6: traceIpv6,
            operation: this.operation,
            lastError,
        });
    }

    public async install(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        return this.withOperation('installing', 'Preparing WARP installation', async () => {
            const permissionError = await this.getPermissionError();
            if (permissionError) {
                this.failOperation(permissionError);
                return this.getStatus(permissionError);
            }

            try {
                await this.installIfMissingOrSingleStack();
                this.appendOperationLog('Normalizing WARP configuration');
                this.normalizeWarpConfig();
                this.finishOperation('WARP installed');
                return await this.getStatus();
            } catch (error) {
                const message = this.toSafeError(error);
                this.logger.warn(`Failed to install WARP: ${message}`);
                this.failOperation(message);
                return this.getStatus(message);
            }
        });
    }

    public async enable(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        return this.withOperation('enabling', 'Preparing WARP enable', async () => {
            if (await this.isInterfaceRunning()) {
                const currentStatus = await this.getStatus();
                if (
                    currentStatus.warp === 'on' &&
                    this.hasDualStackConfig() &&
                    this.hasBoundIpv6RouteConfig() &&
                    this.hasExpectedEndpointConfig() &&
                    !this.hasDeprecatedIpv6EndpointRouteConfig()
                ) {
                    this.finishOperation('WARP is already enabled');
                    return currentStatus;
                }
            }

            const permissionError = await this.getPermissionError();
            if (permissionError) {
                this.failOperation(permissionError);
                return this.getStatus(permissionError);
            }

            try {
                await this.installIfMissingOrSingleStack();
                this.appendOperationLog('Normalizing WARP configuration');
                this.normalizeWarpConfig();
                this.appendOperationLog('Stopping any existing WARP interface');
                await this.stopRunningInterface();
                this.appendOperationLog('Starting WireGuard interface');
                await this.execFixed('/usr/bin/wg-quick', ['up', WARP_INTERFACE], 20_000, {
                    onOutput: (line) => this.appendOperationLog(line),
                });
                this.finishOperation('WARP enabled');
                return await this.getStatus();
            } catch (error) {
                const message = this.toSafeError(error);
                this.logger.warn(`Failed to enable WARP: ${message}`);
                this.failOperation(message);
                return this.getStatus(message);
            }
        });
    }

    public async disable(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        return this.withOperation('disabling', 'Preparing WARP disable', async () => {
            try {
                if (!(await this.isInterfaceRunning())) {
                    this.finishOperation('WARP is already stopped');
                    return await this.getStatus();
                }

                if (this.hasWarpConfig()) {
                    this.appendOperationLog('Stopping WireGuard interface');
                    await this.execFixed('/usr/bin/wg-quick', ['down', WARP_INTERFACE], 20_000, {
                        onOutput: (line) => this.appendOperationLog(line),
                    });
                } else {
                    this.appendOperationLog('Deleting orphaned WARP interface');
                    await this.deleteInterface();
                }

                this.finishOperation('WARP disabled');
                return await this.getStatus();
            } catch (error) {
                try {
                    this.appendOperationLog('Deleting WARP interface after disable failure');
                    await this.deleteInterface();
                    this.finishOperation('WARP disabled with fallback cleanup');
                    return await this.getStatus();
                } catch (fallbackError) {
                    const message = `${this.toSafeError(error)}; fallback delete failed: ${this.toSafeError(fallbackError)}`;
                    this.logger.warn(`Failed to disable WARP: ${message}`);
                    this.failOperation(message);
                    return this.getStatus(message);
                }
            }
        });
    }

    public async uninstall(): Promise<TWarpStatus> {
        if (process.platform !== 'linux') {
            return this.getStatus('WARP is supported only on Linux nodes');
        }

        return this.withOperation('uninstalling', 'Preparing WARP uninstall', async () => {
            try {
                if (await this.isInterfaceRunning()) {
                    this.appendOperationLog('Stopping WARP before uninstall');
                    await this.stopRunningInterface();
                }

                this.removeFileIfExists(WARP_CONFIG_PATH);
                this.removeFileIfExists(WARP_TOOL_PATH);
                this.finishOperation('WARP uninstalled');
                return await this.getStatus();
            } catch (error) {
                const message = this.toSafeError(error);
                this.logger.warn(`Failed to uninstall WARP: ${message}`);
                this.failOperation(message);
                return this.getStatus(message);
            }
        });
    }

    private getEffectiveWarpState(
        running: boolean,
        hasWireGuardHandshake: boolean,
        traceIpv4: TWarpTrace | null,
        traceIpv6: TWarpTrace | null,
    ): TWarpStatus['warp'] {
        if (!running) return 'off';
        if (traceIpv4?.warp === 'on' && traceIpv6?.warp === 'on') return 'on';
        if (hasWireGuardHandshake && (traceIpv4?.warp === 'on' || traceIpv6?.warp === 'on')) {
            return 'unknown';
        }
        if (traceIpv4?.warp === 'off' || traceIpv6?.warp === 'off') return 'unknown';

        return traceIpv4?.warp ?? traceIpv6?.warp ?? 'unknown';
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

        updated = this.removeDeprecatedIpv6EndpointRouteLines(updated);

        if (!this.hasBoundIpv6RouteConfig(updated)) {
            updated = this.removeManagedIpv6RouteLines(updated);
            updated = updated.replace(
                /^Table = off$/m,
                (line) => `${line}\n${WARP_MANAGED_IPV6_ROUTE_LINES.join('\n')}`,
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

    private async installIfMissingOrSingleStack(): Promise<void> {
        if (this.hasWarpConfig() && this.hasDualStackConfig()) {
            this.appendOperationLog('Existing WARP profile is already dual-stack');
            return;
        }

        this.appendOperationLog('Ensuring WARP runtime packages');
        await this.ensureAlpinePackages();
        this.appendOperationLog('Installing WARP profile');
        await this.execFixed('/bin/bash', ['-o', 'pipefail', '-c', WARP_INSTALL_SCRIPT], 180_000, {
            onOutput: (line) => this.appendOperationLog(line),
        });
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

    private hasDualStackConfig(): boolean {
        if (!this.hasWarpConfig()) return false;

        const config = readFileSync(WARP_CONFIG_PATH, 'utf8');
        const addresses = [...config.matchAll(/^Address = (.+)$/gm)]
            .flatMap((match) => match[1].split(','))
            .map((address) => address.trim());

        const hasIpv4 = addresses.some((address) => /^\d{1,3}(?:\.\d{1,3}){3}\/\d+$/.test(address));
        const hasIpv6 = addresses.some((address) => /^[0-9a-f:]+\/\d+$/i.test(address));

        return hasIpv4 && hasIpv6;
    }

    private hasBoundIpv6RouteConfig(config: string | null = null): boolean {
        if (config === null && !this.hasWarpConfig()) return false;

        const warpConfig = config ?? readFileSync(WARP_CONFIG_PATH, 'utf8');
        return WARP_MANAGED_IPV6_ROUTE_LINES.every((line) => warpConfig.includes(line));
    }

    private hasExpectedEndpointConfig(config: string | null = null): boolean {
        if (config === null && !this.hasWarpConfig()) return false;

        const warpConfig = config ?? readFileSync(WARP_CONFIG_PATH, 'utf8');
        return warpConfig.includes(`Endpoint = ${WARP_ENDPOINT}`);
    }

    private hasDeprecatedIpv6EndpointRouteConfig(config: string | null = null): boolean {
        if (config === null && !this.hasWarpConfig()) return false;

        const warpConfig = config ?? readFileSync(WARP_CONFIG_PATH, 'utf8');
        return warpConfig.split('\n').some((line) => this.isDeprecatedIpv6EndpointRouteLine(line));
    }

    private removeManagedIpv6RouteLines(config: string): string {
        return config
            .split('\n')
            .filter((line) => !this.isManagedIpv6RouteLine(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    private removeDeprecatedIpv6EndpointRouteLines(config: string): string {
        return config
            .split('\n')
            .filter((line) => !this.isDeprecatedIpv6EndpointRouteLine(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    private isManagedIpv6RouteLine(line: string): boolean {
        if (WARP_MANAGED_IPV6_ROUTE_LINES.includes(line)) return true;
        if (/^PostUp = ip -6 route replace ::\/0 dev %i metric \d+$/.test(line)) return true;
        if (
            /^PreDown = ip -6 route del ::\/0 dev %i metric \d+ 2>\/dev\/null \|\| true$/.test(line)
        ) {
            return true;
        }
        if (
            /^PreDown = ip -6 route del 2606:4700:d0::a29f:c001\/128 2>\/dev\/null \|\| true$/.test(
                line,
            )
        ) {
            return true;
        }

        return false;
    }

    private isDeprecatedIpv6EndpointRouteLine(line: string): boolean {
        if (
            /^PreDown = ip -6 route del 2606:4700:d0::a29f:c001\/128 2>\/dev\/null \|\| true$/.test(
                line,
            )
        ) {
            return true;
        }

        return /^PostUp = endpoint_route=.*ip -6 route replace 2606:4700:d0::a29f:c001\/128 .* metric \d+$/.test(
            line,
        );
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

    private async getTrace(ipVersion: TWarpTraceIpVersion): Promise<TWarpTrace | null> {
        try {
            const result = await this.execFixed(
                '/usr/bin/curl',
                [
                    '--max-time',
                    '5',
                    `-${ipVersion}`,
                    '--interface',
                    WARP_INTERFACE,
                    '-fsSL',
                    WARP_TRACE_URL,
                ],
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
                publicIp: fields.get('ip') ?? null,
                warp: warp === 'on' || warp === 'off' ? warp : 'unknown',
                colo: fields.get('colo') ?? null,
            };
        } catch {
            return null;
        }
    }

    private async getPublicIpProbe(ipVersion: TWarpTraceIpVersion): Promise<TPublicIpProbe> {
        try {
            const hostInterface = await this.getHostDefaultInterface(ipVersion);
            const isWarpRunning = await this.isInterfaceRunning();

            if (ipVersion === '6' && hostInterface === null && isWarpRunning) {
                return {
                    publicIp: null,
                    reachable: false,
                    lastError: 'No non-WARP IPv6 default interface is available',
                };
            }

            const args = ['--max-time', '5', `-${ipVersion}`];
            if (hostInterface) args.push('--interface', hostInterface);
            args.push('-fsSL', WARP_TRACE_URL);

            const result = await this.execFixed('/usr/bin/curl', args, 8_000);
            const publicIp = this.parseTraceField(result.stdout, 'ip');

            return {
                publicIp,
                reachable: publicIp !== null,
                lastError: null,
            };
        } catch (error) {
            return {
                publicIp: null,
                reachable: false,
                lastError: this.toSafeError(error),
            };
        }
    }

    private async getHostDefaultInterface(ipVersion: TWarpTraceIpVersion): Promise<string | null> {
        const args =
            ipVersion === '4' ? ['route', 'show', 'default'] : ['-6', 'route', 'show', 'default'];

        for (const command of ['/sbin/ip', '/usr/sbin/ip']) {
            try {
                const result = await this.execFixed(command, args, 5_000);
                const defaultRoute = result.stdout
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .filter((line) => !line.includes(`dev ${WARP_INTERFACE}`))
                    .find((line) => line.includes('default'));

                const match = defaultRoute?.match(/\bdev\s+(\S+)/);
                if (match?.[1]) return match[1];
            } catch {
                // Try the next iproute2 location used by common Linux distributions.
            }
        }

        return null;
    }

    private parseTraceField(output: string, field: string): string | null {
        const line = output
            .split('\n')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${field}=`));

        return line?.slice(field.length + 1) ?? null;
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
        options: {
            onOutput?: (line: string) => void;
        } = {},
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
                this.emitOutputLines(chunk, options.onOutput);
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                stderr = this.appendOutputTail(stderr, chunk);
                this.emitOutputLines(chunk, options.onOutput);
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
            publicIpv4: null,
            publicIpv6: null,
            warp: 'unknown',
            colo: null,
            ipv4: null,
            ipv6: null,
            operation: this.operation,
            lastError: null,
            ...partial,
        };
    }

    private hostConnectivity(partial: Partial<THostConnectivity>): THostConnectivity {
        return {
            publicIpv4: null,
            publicIpv6: null,
            supportsIpv4: false,
            supportsIpv6: false,
            ipv4: null,
            ipv6: null,
            lastError: null,
            ...partial,
        };
    }

    private createIdleOperation(): TWarpOperation {
        return {
            state: 'idle',
            startedAt: null,
            finishedAt: null,
            step: null,
            logs: [],
        };
    }

    private async withOperation<T>(
        state: TWarpOperationState,
        step: string,
        action: () => Promise<T>,
    ): Promise<T> {
        this.operation = {
            state,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            step,
            logs: [step],
        };

        return await action();
    }

    private appendOperationLog(message: string): void {
        const line = this.limitOutput(message.trim());
        if (!line) return;

        this.operation = {
            ...this.operation,
            step: line,
            logs: [...this.operation.logs, line].slice(-50),
        };
    }

    private finishOperation(step: string): void {
        this.appendOperationLog(step);
        this.operation = {
            ...this.operation,
            state: 'idle',
            finishedAt: new Date().toISOString(),
            step,
        };
    }

    private failOperation(step: string): void {
        this.appendOperationLog(step);
        this.operation = {
            ...this.operation,
            state: 'error',
            finishedAt: new Date().toISOString(),
            step,
        };
    }

    private emitOutputLines(chunk: Buffer, onOutput: undefined | ((line: string) => void)): void {
        if (!onOutput) return;

        chunk
            .toString('utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach(onOutput);
    }

    private removeFileIfExists(path: string): void {
        if (!existsSync(path)) return;

        this.appendOperationLog(`Removing ${path}`);
        unlinkSync(path);
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
