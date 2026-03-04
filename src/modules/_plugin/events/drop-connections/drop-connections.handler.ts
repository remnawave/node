import { hasCapNetAdmin, killSockets } from 'sockdestroy';

import { IEventHandler, EventsHandler } from '@nestjs/cqrs';
import { Logger, OnModuleInit } from '@nestjs/common';

import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';

import { PluginStateService } from '../../services/plugin-state.service';
import { DropConnectionsEvent } from './drop-connections.event';

@EventsHandler(DropConnectionsEvent)
export class DropConnectionsHandler implements IEventHandler<DropConnectionsEvent>, OnModuleInit {
    public readonly logger = new Logger(DropConnectionsHandler.name);
    private isAvailable = false;

    constructor(private readonly pluginState: PluginStateService) {}

    public async onModuleInit(): Promise<void> {
        try {
            this.isAvailable = hasCapNetAdmin();
        } catch (error) {
            this.logger.error(error);
        }
    }

    async handle(event: DropConnectionsEvent) {
        const ct = getTime();
        try {
            const { ips } = event;
            if (!ips || ips.length === 0 || !this.isAvailable) return;

            for (const ip of ips) {
                if (this.pluginState.connectionDrop.isWhitelisted(ip)) {
                    continue;
                }

                const result = await killSockets({ src: ip, dst: ip, mode: 'or' });
                this.logger.debug(
                    `Destroyed connections for IP: ${ip} - ${JSON.stringify(result, null, 2)}`,
                );
            }
        } catch (error) {
            this.logger.error(`Error in Event DropConnectionsHandler: ${error}`);
        } finally {
            this.logger.debug(`DropConnections handled in: ${formatExecutionTime(ct)}`);
        }
    }
}
