import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PluginStateService } from '../../services/plugin-state.service';
import { GetAbuseBlockerStatsQuery } from './get-abuse-blocker-stats.query';

@QueryHandler(GetAbuseBlockerStatsQuery)
export class GetAbuseBlockerStatsHandler implements IQueryHandler<GetAbuseBlockerStatsQuery> {
    constructor(private readonly pluginState: PluginStateService) {}

    async execute() {
        return {
            available: this.pluginState.plugins.abuseBlocker,
            ...this.pluginState.abuseBlocker.stats,
        };
    }
}
