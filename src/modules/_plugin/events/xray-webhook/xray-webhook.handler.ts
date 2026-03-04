import { isIP } from 'node:net';

import { IEventHandler, EventsHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';
import { TorrentBlockerReportModel, XrayWebhookSchema } from '@libs/contracts/models';

import { PluginStateService } from '../../services/plugin-state.service';
import { XrayWebhookEvent } from './xray-webhook.event';
import { NftService } from '../../services/nft.service';

const SOURCE_REGEX = /^(?:(?:tcp|udp):)?(?:\[(.+?)\]|(.+?))(?::(\d+))?$/;

@EventsHandler(XrayWebhookEvent)
export class XrayWebhookHandler implements IEventHandler<XrayWebhookEvent> {
    public readonly logger = new Logger(XrayWebhookHandler.name);

    constructor(
        private readonly pluginState: PluginStateService,
        private readonly nftService: NftService,
    ) {}
    async handle(event: XrayWebhookEvent) {
        const ct = getTime();
        try {
            if (!this.pluginState.torrentBlocker.isEnabled) return;

            const parsed = await XrayWebhookSchema.safeParseAsync(event.webhook);
            if (!parsed.success) {
                this.logger.error(`Invalid webhook: ${JSON.stringify(parsed.error)}`);
                return;
            }

            this.logger.debug(JSON.stringify(parsed.data, null, 2));

            const webhook = parsed.data;

            const ip = this.extractIp(webhook.source);

            if (!ip || !webhook.email) return;

            const whitelisted =
                this.pluginState.torrentBlocker.isIpIgnored(ip) ||
                this.pluginState.torrentBlocker.isUserIgnored(webhook.email);

            if (whitelisted) {
                return;
            }

            const blockDuration = this.pluginState.torrentBlocker.duration!;

            let blocked = false;

            try {
                await this.nftService.blockIp(ip, blockDuration);
                blocked = true;

                this.logger.log(
                    `[TORRENT-BLOCKER] IP: ${ip}, user: ${webhook.email}, blocked: ${blocked}, duration: ${blockDuration}s`,
                );
            } catch (error) {
                this.logger.error(`Failed to block IP ${ip}:`, error);
            }

            const report: TorrentBlockerReportModel = {
                actionReport: {
                    blocked,
                    ip,
                    blockDuration,
                    willUnblockAt: new Date(Date.now() + blockDuration * 1000),
                    userId: webhook.email,
                    processedAt: new Date(),
                },
                xrayReport: webhook,
            };

            this.pluginState.torrentBlocker.addReport(report);
        } catch (error) {
            this.logger.error(`Error in Event XrayWebhookHandler: ${error}`);
        } finally {
            this.logger.debug(`Webhook handled in: ${formatExecutionTime(ct)}`);
        }
    }

    private extractIp(source: string | null): string | null {
        if (!source) return null;

        const prefixMatch = source.match(SOURCE_REGEX);
        const candidate = prefixMatch ? prefixMatch[1] || prefixMatch[2] : source;

        if (isIP(candidate) === 0) return null;

        return candidate;
    }
}
