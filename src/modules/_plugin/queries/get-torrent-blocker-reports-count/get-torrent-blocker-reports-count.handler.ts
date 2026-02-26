import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { GetTorrentBlockerReportsCountQuery } from './get-torrent-blocker-reports-count.query';
import { PluginStateService } from '../../services/plugin-state.service';

@QueryHandler(GetTorrentBlockerReportsCountQuery)
export class GetTorrentBlockerReportsCountHandler implements IQueryHandler<GetTorrentBlockerReportsCountQuery> {
    private readonly logger = new Logger(GetTorrentBlockerReportsCountHandler.name);
    constructor(private readonly pluginState: PluginStateService) {}

    async execute() {
        try {
            const reportsCount = this.pluginState.torrentBlocker.reportsCount;

            return reportsCount;
        } catch (error) {
            this.logger.error(error);
            return 0;
        }
    }
}
