import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { GetTorrentBlockerStateQuery } from './get-torrent-blocker-state.query';
import { PluginStateService } from '../../services/plugin-state.service';

@QueryHandler(GetTorrentBlockerStateQuery)
export class GetTorrentBlockerStateHandler implements IQueryHandler<GetTorrentBlockerStateQuery> {
    private readonly logger = new Logger(GetTorrentBlockerStateHandler.name);
    constructor(private readonly pluginState: PluginStateService) {}

    async execute() {
        try {
            const isEnabled = this.pluginState.torrentBlocker.isEnabled;

            return isEnabled;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }
}
