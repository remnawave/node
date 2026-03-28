import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { HttpExceptionFilter } from '@common/exception';
import { errorHandler } from '@common/helpers';
import { PLUGIN_CONTROLLER, PLUGIN_ROUTES } from '@libs/contracts/api';

import {
    BlockIpsRequestDto,
    BlockIpsResponseDto,
    CollectReportsResponseDto,
    RecreateTablesResponseDto,
    UnblockIpsRequestDto,
    UnblockIpsResponseDto,
} from './dtos';
import { SyncRequestDto, SyncResponseDto } from './dtos/sync.dto';
import { NftService } from './services/nft.service';
import { PluginService } from './plugin.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(PLUGIN_CONTROLLER)
export class PluginController {
    constructor(
        private readonly pluginService: PluginService,
        private readonly nftService: NftService,
    ) {}

    @Post(PLUGIN_ROUTES.SYNC)
    public async sync(@Body() body: SyncRequestDto): Promise<SyncResponseDto> {
        const response = await this.pluginService.sync(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(PLUGIN_ROUTES.TORRENT_BLOCKER.COLLECT)
    public async collectReports(): Promise<CollectReportsResponseDto> {
        const response = await this.pluginService.collectReports();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(PLUGIN_ROUTES.NFTABLES.BLOCK_IPS)
    public async blockIps(@Body() body: BlockIpsRequestDto): Promise<BlockIpsResponseDto> {
        const response = await this.nftService.blockIpsController(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(PLUGIN_ROUTES.NFTABLES.UNBLOCK_IPS)
    public async unblockIps(@Body() body: UnblockIpsRequestDto): Promise<UnblockIpsResponseDto> {
        const response = await this.nftService.unblockIpsController(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(PLUGIN_ROUTES.NFTABLES.RECREATE_TABLES)
    public async recreateTables(): Promise<RecreateTablesResponseDto> {
        const response = await this.nftService.recreateTablesController();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
