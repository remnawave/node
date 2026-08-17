import { DEFAULT_IGNORED_IPS } from '@common/constants';
import { TorrentBlockerReportModel } from '@libs/contracts/models';

export class TorrentBlockerState {
    private enabled = false;
    private blockDuration: number | null = null;
    private ignoredIps = new Set<string>();
    private ignoredUsers = new Set<string>();
    private includeRuleTags = new Set<string>();
    private webhookUrl: string | null = null;
    private reports: TorrentBlockerReportModel[] = [];
    private lastProcessedUsers = new Map<string, number>();

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

    setWebhookUrl(url: string | undefined | null): void {
        this.webhookUrl = url ?? null;
    }

    getWebhookUrl(): string | null {
        return this.webhookUrl;
    }

    isIpIgnored(ip: string): boolean {
        return this.ignoredIps.has(ip) || DEFAULT_IGNORED_IPS.has(ip);
    }

    isUserIgnored(userId: string): boolean {
        return this.ignoredUsers.has(userId);
    }

    shouldProcess(userId: string, timestamp: number, deduplicationSeconds = 5): boolean {
        const lastProcessedAt = this.lastProcessedUsers.get(userId) ?? 0;
        if (timestamp - lastProcessedAt < deduplicationSeconds * 1000) return false;
        this.lastProcessedUsers.set(userId, timestamp);
        return true;
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
        this.lastProcessedUsers.clear();
    }

    setIncludeRuleTags(tags: string[] | undefined): void {
        if (!tags) return;
        this.includeRuleTags = new Set(tags);
    }

    get includeRuleTagsSet(): Set<string> {
        return this.includeRuleTags;
    }
}
