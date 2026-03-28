import { DEFAULT_IGNORED_IPS } from '@common/constants';
import { TorrentBlockerReportModel } from '@libs/contracts/models';

export class TorrentBlockerState {
    private enabled = false;
    private blockDuration: number | null = null;
    private ignoredIps = new Set<string>();
    private ignoredUsers = new Set<string>();
    private includeRuleTags = new Set<string>();
    private reports: TorrentBlockerReportModel[] = [];

    get isEnabled(): boolean {
        return this.enabled;
    }

    get duration(): number | null {
        return this.blockDuration;
    }

    configure(blockDuration: number): void {
        this.enabled = true;
        this.blockDuration = blockDuration;
    }

    setIgnoredIps(ips: string[]): void {
        this.ignoredIps = new Set(ips);
    }

    setIgnoredUsers(users: string[]): void {
        this.ignoredUsers = new Set(users);
    }

    isIpIgnored(ip: string): boolean {
        return this.ignoredIps.has(ip) || DEFAULT_IGNORED_IPS.has(ip);
    }

    isUserIgnored(userId: string): boolean {
        return this.ignoredUsers.has(userId);
    }

    addReport(report: TorrentBlockerReportModel): void {
        this.reports.push(report);
    }

    flushReports(): TorrentBlockerReportModel[] {
        const flushed = this.reports;
        this.reports = [];
        return flushed;
    }

    get reportsCount(): number {
        return this.reports.length;
    }

    reset(): void {
        this.enabled = false;
        this.blockDuration = null;
        this.ignoredIps.clear();
        this.ignoredUsers.clear();
        this.includeRuleTags.clear();
    }

    setIncludeRuleTags(tags: string[] | undefined): void {
        if (!tags) return;
        this.includeRuleTags = new Set(tags);
    }

    get includeRuleTagsSet(): Set<string> {
        return this.includeRuleTags;
    }
}
