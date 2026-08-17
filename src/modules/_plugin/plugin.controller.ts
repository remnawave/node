import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception';
import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { errorHandler } from '@common/helpers';
import { PLUGIN_CONTROLLER, PLUGIN_ROUTES } from '@libs/contracts/api';

import {
    CollectAbuseBlockerReportsResponseDto,
    BlockIpsRequestDto,
    BlockIpsResponseDto,
    CollectReportsResponseDto,
    RecreateTablesResponseDto,
    RefreshAbuseBlockRequestDto,
    RefreshAbuseBlockResponseDto,
    UnblockIpsRequestDto,
    UnblockIpsResponseDto,
} from './dtos';
import { SyncRequestDto, SyncResponseDto } from './dtos/sync.dto';
import { PluginService } from './plugin.service';
import { NftService } from './services/nft.service';

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

    @Post(PLUGIN_ROUTES.ABUSE_BLOCKER.COLLECT)
    public async collectAbuseBlockerReports(): Promise<CollectAbuseBlockerReportsResponseDto> {
        const response = await this.pluginService.collectAbuseBlockerReports();
        const data = errorHandler(response);

        return { response: data };
    }

    @Post(PLUGIN_ROUTES.ABUSE_BLOCKER.REFRESH_BLOCK)
    public async refreshAbuseBlock(
        @Body() body: RefreshAbuseBlockRequestDto,
    ): Promise<RefreshAbuseBlockResponseDto> {
        try {
            await this.nftService.refreshAbuseIp(body.ip, body.timeout);
            return { response: { accepted: true } };
        } catch {
            return { response: { accepted: false } };
        }
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
