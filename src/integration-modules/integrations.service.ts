import { Inject, Injectable, Logger } from '@nestjs/common';

import { TNodeMetadata } from '@libs/contracts/models';

import {
    INodeIntegration,
    INodeIntegrationResult,
    NODE_INTEGRATIONS,
} from './integrations.contract';

@Injectable()
export class IntegrationsService {
    private readonly logger = new Logger(IntegrationsService.name);

    constructor(@Inject(NODE_INTEGRATIONS) private readonly integrations: INodeIntegration[]) {
        if (this.integrations.length > 0) {
            this.logger.log(
                `Enabled integration(s): ${this.integrations.map((i) => i.name).join(', ')}.`,
            );
        }
    }

    public async sync(
        integrationConfig: unknown | undefined,
        nodeMetadata: TNodeMetadata | undefined,
    ): Promise<INodeIntegrationResult> {
        if (this.integrations.length === 0) return { error: null };
        if (!nodeMetadata) return { error: 'Node metadata is missing.' };

        const errors: string[] = [];

        for (const integration of this.integrations) {
            try {
                const { error } = await integration.sync(
                    this.asRecord(integrationConfig),
                    nodeMetadata,
                );

                if (error) errors.push(`[${integration.name}] ${error}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';

                this.logger.error(`Integration "${integration.name}" threw: ${message}`);

                errors.push(`[${integration.name}] ${message}`);
            }
        }

        return { error: errors.length > 0 ? errors.join('; ') : null };
    }

    public async stop(): Promise<void> {
        for (const integration of this.integrations) {
            try {
                await integration.stop();
            } catch (error) {
                this.logger.warn(`Failed to stop integration "${integration.name}": ${error}`);
            }
        }
    }

    private asRecord(value: unknown): Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    }
}
