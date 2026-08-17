import type { TNodePlugin } from '@remnawave/node-plugins';

import type {
    AbuseBlockerCoverageMode,
    AbuseBlockerPolicy,
    AbuseBlockerReportModel,
    AbuseBlockerRuleName,
    AbuseBlockerSeverity,
    XrayWebhookModel,
} from '@libs/contracts/models';

import { getNetworkKey, IpMatcher } from '../../utils/ip-address.utils';

type AbuseBlockerConfig = NonNullable<TNodePlugin['abuseBlocker']>;

interface IDetectorKeyState {
    destinations: Map<string, number>;
    fired: boolean;
    lastFiredAt: number;
    lastSeenAt: number;
}

interface IUserState {
    horizontal: Map<string, IDetectorKeyState>;
    sweep: Map<string, IDetectorKeyState>;
    scoreEvents: Array<{ score: number; timestamp: number }>;
    lastSeenAt: number;
}

export interface IAbuseBlockerObservation {
    userId: string;
    sourceIp: string;
    destinationIp: string;
    destinationPort: number;
    timestamp: number;
    xrayReport: XrayWebhookModel;
}

export interface IAbuseBlockerDetection {
    rule: AbuseBlockerRuleName;
    key: string;
    uniqueDestinations: number;
    windowSeconds: number;
    score: number;
    subnet: string | null;
}

export interface IAbuseBlockerAnalysis {
    detections: IAbuseBlockerDetection[];
    scoreBefore: number;
    scoreDelta: number;
    scoreAfter: number;
    severity: AbuseBlockerSeverity;
    evidence: Array<{ destinationIp: string; destinationPort: number; lastSeenAt: Date }>;
    shouldBlock: boolean;
}

export class AbuseBlockerState {
    private enabled = false;
    private config: AbuseBlockerConfig | null = null;
    private configFingerprint = '';
    private ignoredUsers = new Set<string>();
    private ignoredSources = new IpMatcher([]);
    private ignoredDestinations = new IpMatcher([]);
    private users = new Map<string, IUserState>();
    private reports = new Map<string, AbuseBlockerReportModel>();
    private coverageMode: AbuseBlockerCoverageMode = 'partial';
    private skippedWebhookRules = 0;
    private evictedUsers = 0;
    private evictedKeys = 0;
    private droppedReports = 0;
    private lastError: string | null = null;

    get isEnabled(): boolean {
        return this.enabled;
    }

    get policy(): AbuseBlockerPolicy | null {
        if (!this.config) return null;
        const config = this.config;
        return {
            excludedPorts: config.excludedPorts,
            scoreWindowSeconds: config.scoreWindowSeconds,
            incidentCooldownSeconds: config.incidentCooldownSeconds,
            suspiciousScore: config.suspiciousScore,
            alertScore: config.alertScore,
            blockScore: config.blockScore,
            initialBlockSeconds: config.initialBlockSeconds,
            repeatBlockSeconds: config.repeatBlockSeconds,
            repeatWindowSeconds: config.repeatWindowSeconds,
            evidenceLimit: config.evidenceLimit,
            enhancedEvidenceLimit: config.enhancedEvidenceLimit,
            maxTrackedUsers: config.maxTrackedUsers,
            maxKeysPerUser: config.maxKeysPerUser,
            reportBufferSize: config.reportBufferSize,
            horizontalScan: config.horizontalScan,
            destinationSweep: config.destinationSweep,
        };
    }

    get fingerprint(): string {
        return this.configFingerprint;
    }

    get scoreWindowSeconds(): number {
        return this.config?.scoreWindowSeconds ?? 0;
    }

    configure(args: {
        config: AbuseBlockerConfig;
        configFingerprint: string;
        ignoredUsers: string[];
        ignoredSources: string[];
        ignoredDestinations: string[];
    }): void {
        this.enabled = true;
        this.config = args.config;
        this.configFingerprint = args.configFingerprint;
        this.ignoredUsers = new Set(args.ignoredUsers);
        this.ignoredSources = new IpMatcher(args.ignoredSources);
        this.ignoredDestinations = new IpMatcher(args.ignoredDestinations);
    }

    analyze(observation: IAbuseBlockerObservation): IAbuseBlockerAnalysis | null {
        const config = this.config;
        if (!this.enabled || !config) return null;
        if (this.ignoredUsers.has(observation.userId)) return null;
        if (this.ignoredSources.matches(observation.sourceIp)) return null;
        if (this.ignoredDestinations.matches(observation.destinationIp)) return null;
        if (config.excludedPorts.includes(observation.destinationPort)) return null;

        const user = this.getUserState(observation.userId, observation.timestamp);
        this.pruneScore(user, observation.timestamp, config.scoreWindowSeconds);
        const scoreBefore = user.scoreEvents.reduce((sum, event) => sum + event.score, 0);
        const detections: IAbuseBlockerDetection[] = [];

        if (config.horizontalScan.enabled) {
            const subnet = getNetworkKey(
                observation.destinationIp,
                config.horizontalScan.ipv4Prefix,
                config.horizontalScan.ipv6Prefix,
            );
            if (subnet) {
                const key = `${observation.destinationPort}|${subnet}`;
                const state = this.getDetectorState(
                    user.horizontal,
                    key,
                    user,
                    observation.timestamp,
                );
                if (
                    this.recordDestination(
                        state,
                        observation,
                        config.horizontalScan.windowSeconds,
                        config.horizontalScan.uniqueDestinations,
                        config.incidentCooldownSeconds,
                    )
                ) {
                    detections.push({
                        rule: 'horizontal_scan',
                        key,
                        uniqueDestinations: state.destinations.size,
                        windowSeconds: config.horizontalScan.windowSeconds,
                        score: config.horizontalScan.score,
                        subnet,
                    });
                }
            }
        }

        if (config.destinationSweep.enabled) {
            const key = String(observation.destinationPort);
            const state = this.getDetectorState(user.sweep, key, user, observation.timestamp);
            if (
                this.recordDestination(
                    state,
                    observation,
                    config.destinationSweep.windowSeconds,
                    config.destinationSweep.uniqueDestinations,
                    config.incidentCooldownSeconds,
                )
            ) {
                detections.push({
                    rule: 'destination_sweep',
                    key,
                    uniqueDestinations: state.destinations.size,
                    windowSeconds: config.destinationSweep.windowSeconds,
                    score: config.destinationSweep.score,
                    subnet: null,
                });
            }
        }

        if (detections.length === 0) {
            this.updateBufferedEvidence(observation.userId, user, observation.destinationPort);
            return null;
        }

        const scoreDelta = detections.reduce((sum, detection) => sum + detection.score, 0);
        user.scoreEvents.push({ score: scoreDelta, timestamp: observation.timestamp });
        const scoreAfter = scoreBefore + scoreDelta;
        if (scoreAfter < config.suspiciousScore) return null;

        const severity: AbuseBlockerSeverity =
            scoreAfter >= config.blockScore
                ? 'blocked'
                : scoreAfter >= config.alertScore
                  ? 'alert'
                  : 'suspicious';
        const evidenceLimit =
            scoreAfter >= config.alertScore ? config.enhancedEvidenceLimit : config.evidenceLimit;

        return {
            detections,
            scoreBefore,
            scoreDelta,
            scoreAfter,
            severity,
            evidence: this.collectEvidence(user, observation.destinationPort, evidenceLimit),
            shouldBlock: scoreAfter >= config.blockScore,
        };
    }

    addReport(report: AbuseBlockerReportModel): void {
        const limit = this.config?.reportBufferSize ?? 1;
        if (!this.reports.has(report.eventId) && this.reports.size >= limit) {
            const oldest = this.reports.keys().next().value as string | undefined;
            if (oldest) this.reports.delete(oldest);
            this.droppedReports += 1;
        }
        this.reports.set(report.eventId, report);
    }

    flushReports(): AbuseBlockerReportModel[] {
        const reports = [...this.reports.values()];
        this.reports.clear();
        return reports;
    }

    setCoverage(mode: AbuseBlockerCoverageMode, skippedWebhookRules: number): void {
        this.coverageMode = mode;
        this.skippedWebhookRules = skippedWebhookRules;
    }

    setLastError(error: unknown): void {
        this.lastError = error instanceof Error ? error.message : String(error);
    }

    get stats() {
        return {
            enabled: this.enabled,
            reportsCount: this.reports.size,
            trackedUsers: this.users.size,
            activeIncidents: [...this.users.values()].reduce(
                (total, user) =>
                    total +
                    [...user.horizontal.values(), ...user.sweep.values()].filter(
                        (state) => state.fired,
                    ).length,
                0,
            ),
            coverageMode: this.coverageMode,
            skippedWebhookRules: this.skippedWebhookRules,
            evictedUsers: this.evictedUsers,
            evictedKeys: this.evictedKeys,
            droppedReports: this.droppedReports,
            lastError: this.lastError,
        };
    }

    reset(): void {
        this.enabled = false;
        this.config = null;
        this.configFingerprint = '';
        this.ignoredUsers.clear();
        this.ignoredSources = new IpMatcher([]);
        this.ignoredDestinations = new IpMatcher([]);
        this.users.clear();
        this.reports.clear();
        this.coverageMode = 'partial';
        this.skippedWebhookRules = 0;
        this.evictedUsers = 0;
        this.evictedKeys = 0;
        this.droppedReports = 0;
        this.lastError = null;
    }

    private getUserState(userId: string, timestamp: number): IUserState {
        const existing = this.users.get(userId);
        if (existing) {
            existing.lastSeenAt = timestamp;
            this.users.delete(userId);
            this.users.set(userId, existing);
            return existing;
        }

        const config = this.config!;
        if (this.users.size >= config.maxTrackedUsers) {
            const oldest = this.users.keys().next().value as string | undefined;
            if (oldest) this.users.delete(oldest);
            this.evictedUsers += 1;
        }

        const state: IUserState = {
            horizontal: new Map(),
            sweep: new Map(),
            scoreEvents: [],
            lastSeenAt: timestamp,
        };
        this.users.set(userId, state);
        return state;
    }

    private getDetectorState(
        map: Map<string, IDetectorKeyState>,
        key: string,
        user: IUserState,
        timestamp: number,
    ): IDetectorKeyState {
        const existing = map.get(key);
        if (existing) {
            existing.lastSeenAt = timestamp;
            map.delete(key);
            map.set(key, existing);
            return existing;
        }

        const config = this.config!;
        if (user.horizontal.size + user.sweep.size >= config.maxKeysPerUser) {
            const candidates = [
                ...[...user.horizontal].map(([candidateKey, state]) => ({
                    map: user.horizontal,
                    key: candidateKey,
                    lastSeenAt: state.lastSeenAt,
                })),
                ...[...user.sweep].map(([candidateKey, state]) => ({
                    map: user.sweep,
                    key: candidateKey,
                    lastSeenAt: state.lastSeenAt,
                })),
            ];
            candidates.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
            const oldest = candidates[0];
            oldest?.map.delete(oldest.key);
            this.evictedKeys += 1;
        }

        const state: IDetectorKeyState = {
            destinations: new Map(),
            fired: false,
            lastFiredAt: 0,
            lastSeenAt: timestamp,
        };
        map.set(key, state);
        return state;
    }

    private recordDestination(
        state: IDetectorKeyState,
        observation: IAbuseBlockerObservation,
        windowSeconds: number,
        threshold: number,
        cooldownSeconds: number,
    ): boolean {
        const cutoff = observation.timestamp - windowSeconds * 1000;
        for (const [destination, lastSeenAt] of state.destinations) {
            if (lastSeenAt < cutoff) state.destinations.delete(destination);
        }

        if (
            state.fired &&
            state.destinations.size < threshold &&
            observation.timestamp - state.lastFiredAt >= cooldownSeconds * 1000
        ) {
            state.fired = false;
        }

        state.destinations.set(observation.destinationIp, observation.timestamp);
        state.lastSeenAt = observation.timestamp;
        if (state.fired || state.destinations.size < threshold) return false;
        if (observation.timestamp - state.lastFiredAt < cooldownSeconds * 1000) return false;

        state.fired = true;
        state.lastFiredAt = observation.timestamp;
        return true;
    }

    private collectEvidence(
        user: IUserState,
        destinationPort: number,
        limit: number,
    ): Array<{ destinationIp: string; destinationPort: number; lastSeenAt: Date }> {
        const destinations = new Map<string, number>();
        const matchingStates = [
            ...[...user.horizontal].flatMap(([key, state]) =>
                key.startsWith(`${destinationPort}|`) ? [state] : [],
            ),
            ...(user.sweep.get(String(destinationPort))
                ? [user.sweep.get(String(destinationPort))!]
                : []),
        ];
        for (const state of matchingStates) {
            for (const [destinationIp, timestamp] of state.destinations) {
                const current = destinations.get(destinationIp) ?? 0;
                if (timestamp > current) destinations.set(destinationIp, timestamp);
            }
        }

        return [...destinations]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([destinationIp, timestamp]) => ({
                destinationIp,
                destinationPort,
                lastSeenAt: new Date(timestamp),
            }));
    }

    private pruneScore(user: IUserState, timestamp: number, windowSeconds: number): void {
        const cutoff = timestamp - windowSeconds * 1000;
        user.scoreEvents = user.scoreEvents.filter((event) => event.timestamp >= cutoff);
    }

    private updateBufferedEvidence(
        userId: string,
        user: IUserState,
        destinationPort: number,
    ): void {
        const limit = this.config?.enhancedEvidenceLimit;
        if (!limit) return;

        for (const report of this.reports.values()) {
            if (report.userId !== userId || report.destinationPort !== destinationPort) continue;
            if (report.score.after < (this.config?.alertScore ?? Number.POSITIVE_INFINITY))
                continue;

            report.evidence = this.collectEvidence(user, destinationPort, limit);
        }
    }
}
