import { Injectable, Logger } from '@nestjs/common';

import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants';

import {
    GetAllInboundsStatsResponseModel,
    GetAllOutboundsStatsResponseModel,
    GetCombinedStatsResponseModel,
    GetInboundStatsResponseModel,
    GetOutboundStatsResponseModel,
    GetSystemStatsResponseModel,
    GetUserIpListResponseModel,
    GetUserOnlineStatusResponseModel,
    GetUsersStatsResponseModel,
} from './models';
import { IGetUserOnlineStatusRequest } from './interfaces';

@Injectable()
export class StatsService {
    constructor(@InjectXtls() private readonly xtlsSdk: XtlsApi) {}
    private readonly logger = new Logger(StatsService.name);

    public async getUserOnlineStatus(
        body: IGetUserOnlineStatusRequest,
    ): Promise<ICommandResponse<GetUserOnlineStatusResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getUserOnlineStatus(body.username);

            if (response.isOk && response.data) {
                return {
                    isOk: true,
                    response: new GetUserOnlineStatusResponseModel(response.data.online),
                };
            }

            return {
                isOk: true,
                response: new GetUserOnlineStatusResponseModel(false),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: true,
                response: new GetUserOnlineStatusResponseModel(false),
            };
        }
    }

    public async getSystemStats(): Promise<ICommandResponse<GetSystemStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getSysStats();

            if (!response.isOk || !response.data) {
                this.logger.warn(response);
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_SYSTEM_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetSystemStatsResponseModel(response.data),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_SYSTEM_STATS,
            };
        }
    }

    public async getUsersStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetUsersStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getAllUsersStats(reset);

            if (!response.isOk || !response.data) {
                this.logger.warn(response);

                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_USERS_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetUsersStatsResponseModel(
                    response.data.users.filter((user) => user.uplink !== 0 || user.downlink !== 0),
                ),
            };

            // const demoRes = Array.from({ length: 160_000 }, (_, i) => ({
            //     username: String(i + 1),
            //     uplink: Math.floor(Math.random() * (107374182400 - 10485760) + 10485760), // Random between 10MB and 100GB
            //     downlink: Math.floor(Math.random() * (107374182400 - 10485760) + 10485760), // Random between 10MB and 100GB
            // }));

            // return {
            //     isOk: true,
            //     response: new GetUsersStatsResponseModel(demoRes),
            // };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_USERS_STATS,
            };
        }
    }

    public async getInboundStats(
        tag: string,
        reset: boolean,
    ): Promise<ICommandResponse<GetInboundStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getInboundStats(tag, reset);

            if (!response.isOk || !response.data || !response.data.inbound) {
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_INBOUND_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetInboundStatsResponseModel({
                    inbound: response.data.inbound.inbound,
                    downlink: response.data.inbound.downlink,
                    uplink: response.data.inbound.uplink,
                }),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_INBOUND_STATS,
            };
        }
    }

    public async getOutboundStats(
        tag: string,
        reset: boolean,
    ): Promise<ICommandResponse<GetOutboundStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getOutboundStats(tag, reset);

            if (!response.isOk || !response.data || !response.data.outbound) {
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_OUTBOUND_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetOutboundStatsResponseModel({
                    outbound: response.data.outbound.outbound,
                    downlink: response.data.outbound.downlink,
                    uplink: response.data.outbound.uplink,
                }),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_OUTBOUND_STATS,
            };
        }
    }

    public async getAllInboundsStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetAllInboundsStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getAllInboundsStats(reset);

            if (!response.isOk || !response.data) {
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_INBOUNDS_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetAllInboundsStatsResponseModel(response.data.inbounds),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_INBOUNDS_STATS,
            };
        }
    }

    public async getAllOutboundsStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetAllOutboundsStatsResponseModel>> {
        try {
            const response = await this.xtlsSdk.stats.getAllOutboundsStats(reset);

            if (!response.isOk || !response.data) {
                this.logger.error(response);
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_OUTBOUNDS_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetAllOutboundsStatsResponseModel(response.data.outbounds),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_INBOUNDS_STATS,
            };
        }
    }

    public async getCombinedStats(
        reset: boolean,
    ): Promise<ICommandResponse<GetCombinedStatsResponseModel>> {
        try {
            const { isOk: isOkInbounds, data: inboundsData } =
                await this.xtlsSdk.stats.getAllInboundsStats(reset);
            const { isOk: isOkOutbounds, data: outboundsData } =
                await this.xtlsSdk.stats.getAllOutboundsStats(reset);

            if (!isOkInbounds || !inboundsData || !isOkOutbounds || !outboundsData) {
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_COMBINED_STATS,
                };
            }

            return {
                isOk: true,
                response: new GetCombinedStatsResponseModel(
                    inboundsData.inbounds,
                    outboundsData.outbounds,
                ),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_COMBINED_STATS,
            };
        }
    }

    public async getUserIpList(
        userId: string,
    ): Promise<ICommandResponse<GetUserIpListResponseModel>> {
        try {
            const userIps = await this.xtlsSdk.stats.rawClient.getStatsOnlineIpList({
                name: `user>>>${userId}>>>online`,
                reset: true,
            });

            const ips = Object.keys(userIps.ips);

            if (ips.length === 0) {
                return {
                    isOk: true,
                    response: new GetUserIpListResponseModel([]),
                };
            }

            return {
                isOk: true,
                response: new GetUserIpListResponseModel(ips),
            };
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
                return {
                    isOk: true,
                    response: new GetUserIpListResponseModel([]),
                };
            }

            this.logger.error(error);
            return {
                isOk: true,
                response: new GetUserIpListResponseModel([]),
            };
        }
    }
}
