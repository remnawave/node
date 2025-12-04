import { Injectable, Logger } from '@nestjs/common';

import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants';

import {
    GetAllInboundsStatsResponseModel,
    GetAllOutboundsStatsResponseModel,
    GetInboundStatsResponseModel,
    GetOutboundStatsResponseModel,
    GetSystemStatsResponseModel,
    GetUserOnlineStatusResponseModel,
    GetUsersStatsResponseModel,
} from './models';
import { IGetUserOnlineStatusRequest } from './interfaces';

/**
 * Stats service for sing-box.
 *
 * NOTE: This is a stub implementation as sing-box V2Ray API requires
 * additional configuration and gRPC client setup. These methods return
 * empty/default data until V2Ray API integration is implemented.
 *
 * TODO: Implement V2Ray API gRPC client for statistics
 * Config required in sing-box:
 * {
 *   "experimental": {
 *     "v2ray_api": {
 *       "listen": "127.0.0.1:10085",
 *       "stats": { "enabled": true, "users": [...] }
 *     }
 *   }
 * }
 */
@Injectable()
export class StatsService {
    private readonly logger = new Logger(StatsService.name);

    constructor() {
        this.logger.warn(
            'StatsService: Running in stub mode. Statistics are not available without V2Ray API.',
        );
    }

    /**
     * Gets user online status.
     * Stub: Always returns offline as sing-box doesn't track online status without V2Ray API.
     */
    public async getUserOnlineStatus(
        body: IGetUserOnlineStatusRequest,
    ): Promise<ICommandResponse<GetUserOnlineStatusResponseModel>> {
        this.logger.debug(`getUserOnlineStatus called for user: ${body.username} (stub)`);

        return {
            isOk: true,
            response: new GetUserOnlineStatusResponseModel(false),
        };
    }

    /**
     * Gets system statistics.
     * Stub: Returns empty stats as not available without V2Ray API.
     */
    public async getSystemStats(): Promise<ICommandResponse<GetSystemStatsResponseModel>> {
        this.logger.debug('getSystemStats called (stub)');

        // Return minimal system stats
        return {
            isOk: true,
            response: new GetSystemStatsResponseModel({
                numGoroutine: 0,
                numGC: 0,
                alloc: 0,
                totalAlloc: 0,
                sys: 0,
                mallocs: 0,
                frees: 0,
                liveObjects: 0,
                pauseTotalNs: 0,
                uptime: 0,
            }),
        };
    }

    /**
     * Gets all users' traffic statistics.
     * Stub: Returns empty array as not available without V2Ray API.
     */
    public async getUsersStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetUsersStatsResponseModel>> {
        this.logger.debug(`getUsersStats called with reset=${reset} (stub)`);

        return {
            isOk: true,
            response: new GetUsersStatsResponseModel([]),
        };
    }

    /**
     * Gets inbound statistics.
     * Stub: Returns zero stats as not available without V2Ray API.
     */
    public async getInboundStats(
        tag: string,
        reset: boolean,
    ): Promise<ICommandResponse<GetInboundStatsResponseModel>> {
        this.logger.debug(`getInboundStats called for tag=${tag}, reset=${reset} (stub)`);

        return {
            isOk: true,
            response: new GetInboundStatsResponseModel({
                inbound: tag,
                downlink: 0,
                uplink: 0,
            }),
        };
    }

    /**
     * Gets outbound statistics.
     * Stub: Returns zero stats as not available without V2Ray API.
     */
    public async getOutboundStats(
        tag: string,
        reset: boolean,
    ): Promise<ICommandResponse<GetOutboundStatsResponseModel>> {
        this.logger.debug(`getOutboundStats called for tag=${tag}, reset=${reset} (stub)`);

        return {
            isOk: true,
            response: new GetOutboundStatsResponseModel({
                outbound: tag,
                downlink: 0,
                uplink: 0,
            }),
        };
    }

    /**
     * Gets all inbounds' statistics.
     * Stub: Returns empty array as not available without V2Ray API.
     */
    public async getAllInboundsStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetAllInboundsStatsResponseModel>> {
        this.logger.debug(`getAllInboundsStats called with reset=${reset} (stub)`);

        return {
            isOk: true,
            response: new GetAllInboundsStatsResponseModel([]),
        };
    }

    /**
     * Gets all outbounds' statistics.
     * Stub: Returns empty array as not available without V2Ray API.
     */
    public async getAllOutboundsStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetAllOutboundsStatsResponseModel>> {
        this.logger.debug(`getAllOutboundsStats called with reset=${reset} (stub)`);

        return {
            isOk: true,
            response: new GetAllOutboundsStatsResponseModel([]),
        };
    }
}
