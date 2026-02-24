import { Body, Controller, Get, Post, UseFilters, UseGuards } from '@nestjs/common';

import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { HttpExceptionFilter } from '@common/exception';
import { errorHandler } from '@common/helpers';
import { STATS_CONTROLLER, STATS_ROUTES } from '@libs/contracts/api/controllers/stats';

import {
    GetAllInboundsStatsRequestDto,
    GetAllInboundsStatsResponseDto,
    GetAllOutboundsStatsRequestDto,
    GetAllOutboundsStatsResponseDto,
    GetCombinedStatsRequestDto,
    GetCombinedStatsResponseDto,
    GetInboundStatsRequestDto,
    GetInboundStatsResponseDto,
    GetOutboundStatsRequestDto,
    GetOutboundStatsResponseDto,
    GetSystemStatsResponseDto,
    GetUserOnlineStatusRequestDto,
    GetUserOnlineStatusResponseDto,
    GetUsersStatsRequestDto,
    GetUsersStatsResponseDto,
} from './dto';
import { GetUserIpListRequestDto, GetUserIpListResponseDto } from './dto/get-user-ip-list.dto';
import { StatsService } from './stats.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(STATS_CONTROLLER)
export class StatsController {
    constructor(private readonly statsService: StatsService) {}

    @Post(STATS_ROUTES.GET_USER_ONLINE_STATUS)
    public async getUserOnlineStatus(
        @Body() body: GetUserOnlineStatusRequestDto,
    ): Promise<GetUserOnlineStatusResponseDto> {
        const response = await this.statsService.getUserOnlineStatus(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(STATS_ROUTES.GET_SYSTEM_STATS)
    public async getSystemStats(): Promise<GetSystemStatsResponseDto> {
        const response = await this.statsService.getSystemStats();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_USERS_STATS)
    public async getUsersStats(
        @Body() body: GetUsersStatsRequestDto,
    ): Promise<GetUsersStatsResponseDto> {
        const { reset } = body;
        const response = await this.statsService.getUsersStats(reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_INBOUND_STATS)
    public async getInboundStats(
        @Body() body: GetInboundStatsRequestDto,
    ): Promise<GetInboundStatsResponseDto> {
        const { tag, reset } = body;
        const response = await this.statsService.getInboundStats(tag, reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_OUTBOUND_STATS)
    public async getOutboundStats(
        @Body() body: GetOutboundStatsRequestDto,
    ): Promise<GetOutboundStatsResponseDto> {
        const { tag, reset } = body;
        const response = await this.statsService.getOutboundStats(tag, reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_ALL_INBOUNDS_STATS)
    public async getAllInboundsStats(
        @Body() body: GetAllInboundsStatsRequestDto,
    ): Promise<GetAllInboundsStatsResponseDto> {
        const { reset } = body;
        const response = await this.statsService.getAllInboundsStats(reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_ALL_OUTBOUNDS_STATS)
    public async getAllOutboundsStats(
        @Body() body: GetAllOutboundsStatsRequestDto,
    ): Promise<GetAllOutboundsStatsResponseDto> {
        const { reset } = body;
        const response = await this.statsService.getAllOutboundsStats(reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_COMBINED_STATS)
    public async getCombinedStats(
        @Body() body: GetCombinedStatsRequestDto,
    ): Promise<GetCombinedStatsResponseDto> {
        const { reset } = body;
        const response = await this.statsService.getCombinedStats(reset);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(STATS_ROUTES.GET_USER_IP_LIST)
    public async getUserIpList(
        @Body() body: GetUserIpListRequestDto,
    ): Promise<GetUserIpListResponseDto> {
        const { userId } = body;
        const response = await this.statsService.getUserIpList(userId);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
