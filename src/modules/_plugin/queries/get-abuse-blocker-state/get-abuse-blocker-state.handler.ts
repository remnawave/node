import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PluginStateService } from '../../services/plugin-state.service';
import { GetAbuseBlockerStateQuery } from './get-abuse-blocker-state.query';

@QueryHandler(GetAbuseBlockerStateQuery)
export class GetAbuseBlockerStateHandler implements IQueryHandler<GetAbuseBlockerStateQuery> {
    private readonly logger = new Logger(GetAbuseBlockerStateHandler.name);

    constructor(private readonly pluginState: PluginStateService) {}

    async execute(): Promise<{ enabled: boolean }> {
        return { enabled: this.pluginState.abuseBlocker.isEnabled };
    }
}
