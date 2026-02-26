export class ConnectionDropState {
    private whitelistIps = new Set<string>();

    setWhitelistIps(ips: string[]): void {
        this.whitelistIps = new Set(ips);
    }

    isWhitelisted(ip: string): boolean {
        return this.whitelistIps.has(ip);
    }

    getWhitelistIps(): string[] {
        return Array.from(this.whitelistIps);
    }

    reset(): void {
        this.whitelistIps.clear();
    }
}
