import type { IAbuseBlockerObservation } from '../../services/states/abuse-blocker.state';

import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';
import {
    type AbuseBlockerReportModel,
    type XrayWebhookModel,
    XrayWebhookSchema,
} from '@libs/contracts/models';

import { NftService } from '../../services/nft.service';
import { PluginStateService } from '../../services/plugin-state.service';
import { parseNetworkEndpoint } from '../../utils/ip-address.utils';
import { XrayWebhookEvent } from './xray-webhook.event';

const WEBHOOK_TIMEOUT_MS = 5_000;

export const toAbuseBlockerObservation = (
    webhook: XrayWebhookModel,
): IAbuseBlockerObservation | null => {
    if (webhook.network.toLowerCase() !== 'tcp') return null;
    if (!webhook.email || !/^\d+$/.test(webhook.email)) return null;

    const source = parseNetworkEndpoint(webhook.source);
    const destination = [webhook.originalTarget, webhook.routeTarget, webhook.destination]
        .map(parseNetworkEndpoint)
        .find((candidate) => candidate?.port && candidate.port >= 1 && candidate.port <= 65535);
    if (!source || !destination?.port) return null;

    return {
        userId: webhook.email,
        sourceIp: source.ip,
        destinationIp: destination.ip,
        destinationPort: destination.port,
        timestamp: Number.isFinite(webhook.ts) ? webhook.ts * 1000 : Date.now(),
        xrayReport: webhook,
    };
};

@EventsHandler(XrayWebhookEvent)
export class XrayWebhookHandler implements IEventHandler<XrayWebhookEvent> {
    public readonly logger = new Logger(XrayWebhookHandler.name);

    constructor(
        private readonly pluginState: PluginStateService,
        private readonly nftService: NftService,
    ) {}

    async handle(event: XrayWebhookEvent): Promise<void> {
        const ct = getTime();
        try {
            const parsed = await XrayWebhookSchema.safeParseAsync(event.webhook);
            if (!parsed.success) {
                this.logger.error(`Invalid webhook: ${JSON.stringify(parsed.error)}`);
                return;
            }

            if (event.target === 'torrent' || event.target === 'combined') {
                await this.handleTorrentBlocker(parsed.data);
            }
            if (event.target === 'abuse' || event.target === 'combined') {
                await this.handleAbuseBlocker(parsed.data);
            }
        } catch (error) {
            this.logger.error(`Error in XrayWebhookHandler: ${error}`);
        } finally {
            this.logger.debug(`Webhook handled in: ${formatExecutionTime(ct)}`);
        }
    }

    private async handleTorrentBlocker(webhook: XrayWebhookModel): Promise<void> {
        const state = this.pluginState.torrentBlocker;
        if (!state.isEnabled || !webhook.email) return;

        const source = parseNetworkEndpoint(webhook.source);
        if (!source) return;
        if (!state.shouldProcess(webhook.email, Date.now())) return;
        if (state.isIpIgnored(source.ip) || state.isUserIgnored(webhook.email)) return;

        const blockDuration = state.duration!;
        let blocked = false;
        try {
            await this.nftService.blockIp(source.ip, blockDuration);
            blocked = true;
        } catch (error) {
            this.logger.error(`Failed to block torrent source IP ${source.ip}: ${error}`);
        }

        const report = {
            actionReport: {
                blocked,
                ip: source.ip,
                blockDuration,
                willUnblockAt: new Date(Date.now() + blockDuration * 1000),
                userId: webhook.email,
                processedAt: new Date(),
            },
            xrayReport: webhook,
        };
        state.addReport(report);

        const webhookUrl = state.getWebhookUrl();
        if (webhookUrl) this.sendWebhook(webhookUrl, report);
    }

    private async handleAbuseBlocker(webhook: XrayWebhookModel): Promise<void> {
        const state = this.pluginState.abuseBlocker;
        if (!state.isEnabled) return;

        const observation = toAbuseBlockerObservation(webhook);
        if (!observation) return;

        const analysis = state.analyze(observation);
        if (!analysis) return;

        const policy = state.policy;
        if (!policy) return;

        let blocked = false;
        let blockError: string | null = null;
        if (analysis.shouldBlock) {
            try {
                await this.nftService.blockAbuseIp(
                    observation.sourceIp,
                    policy.initialBlockSeconds,
                );
                blocked = true;
            } catch (error) {
                blockError = error instanceof Error ? error.message : String(error);
                state.setLastError(error);
            }
        }

        const processedAt = new Date();
        const report: AbuseBlockerReportModel = {
            eventId: randomUUID(),
            userId: observation.userId,
            sourceIp: observation.sourceIp,
            destinationIp: observation.destinationIp,
            destinationPort: observation.destinationPort,
            detectedAt: new Date(observation.timestamp),
            detections: analysis.detections,
            score: {
                before: analysis.scoreBefore,
                delta: analysis.scoreDelta,
                after: analysis.scoreAfter,
                windowSeconds: state.scoreWindowSeconds,
            },
            severity: analysis.severity,
            evidence: analysis.evidence,
            actionReport: {
                action: analysis.shouldBlock ? 'ip_block' : 'none',
                blocked,
                blockDuration: analysis.shouldBlock ? policy.initialBlockSeconds : 0,
                willUnblockAt:
                    analysis.shouldBlock && blocked
                        ? new Date(processedAt.getTime() + policy.initialBlockSeconds * 1000)
                        : null,
                error: blockError,
                processedAt,
            },
            policy,
            configFingerprint: state.fingerprint,
            coverageMode: state.stats.coverageMode,
            xrayReport: webhook,
        };

        state.addReport(report);
        this.logger.log(
            `[ABUSE-BLOCKER] user=${observation.userId}, source=${observation.sourceIp}, score=${analysis.scoreAfter}, severity=${analysis.severity}, blocked=${blocked}`,
        );
    }

    private sendWebhook(url: string, report: unknown): void {
        fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(report),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        })
            .then((response) => response.body?.cancel())
            .catch(() => void 0);
    }
}
