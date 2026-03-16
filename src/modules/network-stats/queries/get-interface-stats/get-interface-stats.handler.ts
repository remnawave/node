import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { GetInterfaceStatsQuery } from './get-interface-stats.query';
import { NetworkStatsService } from '../../network-stats.service';

@QueryHandler(GetInterfaceStatsQuery)
export class GetInterfaceStatsHandler implements IQueryHandler<GetInterfaceStatsQuery> {
    private readonly logger = new Logger(GetInterfaceStatsHandler.name);
    constructor(private readonly networkStatsService: NetworkStatsService) {}

    async execute() {
        return this.networkStatsService.getDefault();
    }
}
