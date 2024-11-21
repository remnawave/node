import { Controller, Post, Body, UseGuards, Get, UseFilters } from '@nestjs/common';
import { StatsService } from './stats.service';
import { STATS_CONTROLLER, STATS_ROUTES } from '../../../libs/contract/api/controllers/stats';
import { errorHandler } from '../../common/helpers/error-handler.helper';
import {
    GetAllInboundsStatsRequestDto,
    GetAllInboundsStatsResponseDto,
    GetAllOutboundsStatsRequestDto,
    GetAllOutboundsStatsResponseDto,
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
import { JwtDefaultGuard } from '../../common/guards/jwt-guards/def-jwt-guard';
import { HttpExceptionFilter } from '../../common/exception/httpException.filter';

@Controller(STATS_CONTROLLER)
@UseGuards(JwtDefaultGuard)
@UseFilters(HttpExceptionFilter)
export class StatsController {
    constructor(private readonly statsService: StatsService) {
        this.statsService = statsService;
    }

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

    @Get(STATS_ROUTES.GET_ALL_INBOUNDS_STATS)
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

    @Get(STATS_ROUTES.GET_ALL_OUTBOUNDS_STATS)
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
}
