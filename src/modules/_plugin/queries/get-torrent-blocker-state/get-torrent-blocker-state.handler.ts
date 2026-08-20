import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PluginStateService } from '../../services/plugin-state.service';
import { GetTorrentBlockerStateQuery } from './get-torrent-blocker-state.query';

@QueryHandler(GetTorrentBlockerStateQuery)
export class GetTorrentBlockerStateHandler implements IQueryHandler<GetTorrentBlockerStateQuery> {
    private readonly logger = new Logger(GetTorrentBlockerStateHandler.name);
    constructor(private readonly pluginState: PluginStateService) {}

    async execute() {
        try {
            const isEnabled = this.pluginState.torrentBlocker.isEnabled;

            return {
                enabled: isEnabled,
                includeRuleTags: this.pluginState.torrentBlocker.includeRuleTagsSet,
                rulePosition: this.pluginState.torrentBlocker.rulePosition,
            };
        } catch (error) {
            this.logger.error(error);
            return {
                enabled: false,
                includeRuleTags: new Set<string>(),
                rulePosition: 0,
            };
        }
    }
}
