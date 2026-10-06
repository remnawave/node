import { Injectable, Logger } from '@nestjs/common';

import { sendWebhook } from '@common/utils/send-webhook';
import { TNodeMetadata } from '@libs/contracts/models';

import { PluginStateService } from './plugin-state.service';

@Injectable()
export class PostStartService {
    private readonly logger = new Logger(PostStartService.name);

    constructor(private readonly state: PluginStateService) {}

    public run(metadata: TNodeMetadata | undefined): void {
        if (!this.state.plugins.postStart) return;
        if (!this.state.postStart.isEnabled) return;

        this.sendCoreStartedWebhook(metadata);
    }

    private sendCoreStartedWebhook(metadata: TNodeMetadata | undefined): void {
        const { enabled, url } = this.state.postStart.webhookConfig;

        if (!enabled) return;

        sendWebhook(
            url,
            {
                scope: 'service',
                event: 'service.core_started',
                timestamp: new Date().toISOString(),
                metadata: metadata ?? {},
            },
            (error) => this.logger.warn(`[POST-START] Webhook failed: ${error}`),
        );
    }
}
