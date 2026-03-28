import { DEFAULT_IGNORED_IPS } from '@common/constants';

export class ConnectionDropState {
    private whitelistIps = new Set<string>();

    setWhitelistIps(ips: string[]): void {
        this.whitelistIps = new Set(ips);
    }

    isWhitelisted(ip: string): boolean {
        return this.whitelistIps.has(ip) || DEFAULT_IGNORED_IPS.has(ip);
    }

    getWhitelistIps(): string[] {
        return Array.from(this.whitelistIps);
    }

    reset(): void {
        this.whitelistIps.clear();
    }
}
