import { killSockets, hasCapNetAdmin } from 'sockdestroy';
import ems from 'enhanced-ms';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
    RemoveUserResponseModel as RemoveUserResponseModelFromSdk,
    AddUserResponseModel as AddUserResponseModelFromSdk,
} from '@remnawave/xtls-sdk/build/src/handler/models';
import { ISdkResponse } from '@remnawave/xtls-sdk/build/src/common/types';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';
import { CipherType } from '@libs/contracts/commands';

import {
    AddUserRequestDto,
    AddUsersRequestDto,
    DropIpsRequestDto,
    DropUsersConnectionsRequestDto,
    RemoveUserRequestDto,
    RemoveUsersRequestDto,
} from './dtos';
import {
    GetInboundUsersCountResponseModel,
    GetInboundUsersResponseModel,
    AddUserResponseModel,
    RemoveUserResponseModel,
    GenericResponseModel,
} from './models';
import { InternalService } from '../internal/internal.service';

@Injectable()
export class HandlerService implements OnModuleInit {
    private readonly logger = new Logger(HandlerService.name);
    private capNetAdminAvailable = false;

    constructor(
        @InjectXtls() private readonly xtlsApi: XtlsApi,
        private readonly internalService: InternalService,
    ) {}

    public async onModuleInit(): Promise<void> {
        try {
            if (!hasCapNetAdmin()) {
                this.capNetAdminAvailable = false;
                this.logger.warn('CAP_NET_ADMIN is not available.');
            } else {
                this.capNetAdminAvailable = true;
                this.logger.log('[OK] CAP_NET_ADMIN is available');
            }
        } catch (error: unknown) {
            this.logger.error(error);
        }
    }

    public async addUser(data: AddUserRequestDto): Promise<ICommandResponse<AddUserResponseModel>> {
        try {
            const { data: requestData, hashData } = data;
            const response: Array<ISdkResponse<AddUserResponseModelFromSdk>> = [];

            for (const item of requestData) {
                this.internalService.addXtlsConfigInbound(item.tag);
            }

            for (const tag of this.internalService.getXtlsConfigInbounds()) {
                this.logger.debug(`Removing user: ${requestData[0].username} from tag: ${tag}`);

                await this.xtlsApi.handler.removeUser(tag, requestData[0].username);

                if (hashData.prevVlessUuid) {
                    await this.internalService.removeUserFromInbound(tag, hashData.prevVlessUuid);
                } else {
                    await this.internalService.removeUserFromInbound(tag, hashData.vlessUuid);
                }
            }

            for (const item of requestData) {
                let tempRes = null;

                this.logger.debug(`Adding user: ${item.username} with type: ${item.type}`);

                switch (item.type) {
                    case 'trojan':
                        tempRes = await this.xtlsApi.handler.addTrojanUser({
                            tag: item.tag,
                            username: item.username,
                            password: item.password,
                            level: 0,
                        });
                        if (tempRes.isOk) {
                            await this.internalService.addUserToInbound(
                                item.tag,
                                hashData.vlessUuid,
                            );
                        }
                        response.push(tempRes);
                        break;
                    case 'vless':
                        tempRes = await this.xtlsApi.handler.addVlessUser({
                            tag: item.tag,
                            username: item.username,
                            uuid: item.uuid,
                            flow: item.flow,
                            level: 0,
                        });
                        if (tempRes.isOk) {
                            await this.internalService.addUserToInbound(
                                item.tag,
                                hashData.vlessUuid,
                            );
                        }
                        response.push(tempRes);
                        break;
                    case 'shadowsocks':
                        tempRes = await this.xtlsApi.handler.addShadowsocksUser({
                            tag: item.tag,
                            username: item.username,
                            password: item.password,
                            cipherType: item.cipherType,
                            ivCheck: item.ivCheck,
                            level: 0,
                        });
                        if (tempRes.isOk) {
                            await this.internalService.addUserToInbound(
                                item.tag,
                                hashData.vlessUuid,
                            );
                        }
                        response.push(tempRes);
                        break;
                }
            }

            if (response.every((res) => !res.isOk)) {
                this.logger.error('Error adding users: ' + JSON.stringify(response, null, 2));
                return {
                    isOk: true,
                    response: new AddUserResponseModel(
                        false,
                        response.find((res) => !res.isOk)?.message ?? null,
                    ),
                };
            }

            return {
                isOk: true,
                response: new AddUserResponseModel(true, null),
            };
        } catch (error) {
            this.logger.error(error);
            let message = '';
            if (error instanceof Error) {
                message = error.message;
            }
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new AddUserResponseModel(false, message),
            };
        }
    }

    public async removeUser(
        data: RemoveUserRequestDto,
    ): Promise<ICommandResponse<RemoveUserResponseModel>> {
        try {
            const { username, hashData } = data;
            const response: Array<ISdkResponse<RemoveUserResponseModelFromSdk>> = [];

            const inboundTags = this.internalService.getXtlsConfigInbounds();

            if (inboundTags.size === 0) {
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(true, null),
                };
            }

            const userIps = await this.getUserIps(username);

            for (const tag of inboundTags) {
                this.logger.debug(`Removing user: ${username} from tag: ${tag}`);

                const tempRes = await this.xtlsApi.handler.removeUser(tag, username);

                await this.internalService.removeUserFromInbound(tag, hashData.vlessUuid);
                response.push(tempRes);
            }

            await this.destroyConnections(userIps);

            if (response.every((res) => !res.isOk)) {
                this.logger.error(JSON.stringify(response, null, 2));
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(
                        false,
                        response.find((res) => !res.isOk)?.message ?? null,
                    ),
                };
            }

            return {
                isOk: true,
                response: new RemoveUserResponseModel(true, null),
            };
        } catch (error: unknown) {
            this.logger.error(error);
            let message = '';
            if (error instanceof Error) {
                message = error.message;
            }
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new RemoveUserResponseModel(false, message),
            };
        }
    }

    public async addUsers(
        data: AddUsersRequestDto,
    ): Promise<ICommandResponse<AddUserResponseModel>> {
        const tm = performance.now();
        try {
            const { affectedInboundTags, users } = data;

            for (const tag of affectedInboundTags) {
                this.internalService.addXtlsConfigInbound(tag);
            }

            this.logger.log(
                `Adding ${users.length} users to inbounds: ${affectedInboundTags.join(', ')}`,
            );

            for (const user of users) {
                for (const tag of this.internalService.getXtlsConfigInbounds()) {
                    await this.xtlsApi.handler.removeUser(tag, user.userData.userId);

                    await this.internalService.removeUserFromInbound(tag, user.userData.hashUuid);
                }

                for (const item of user.inboundData) {
                    let tempRes = null;

                    switch (item.type) {
                        case 'trojan':
                            tempRes = await this.xtlsApi.handler.addTrojanUser({
                                tag: item.tag,
                                username: user.userData.userId,
                                password: user.userData.trojanPassword,
                                level: 0,
                            });
                            if (tempRes.isOk) {
                                await this.internalService.addUserToInbound(
                                    item.tag,
                                    user.userData.vlessUuid,
                                );
                            }

                            break;
                        case 'vless':
                            tempRes = await this.xtlsApi.handler.addVlessUser({
                                tag: item.tag,
                                username: user.userData.userId,
                                uuid: user.userData.vlessUuid,
                                flow: item.flow,
                                level: 0,
                            });
                            if (tempRes.isOk) {
                                await this.internalService.addUserToInbound(
                                    item.tag,
                                    user.userData.vlessUuid,
                                );
                            }
                            break;
                        case 'shadowsocks':
                            tempRes = await this.xtlsApi.handler.addShadowsocksUser({
                                tag: item.tag,
                                username: user.userData.userId,
                                password: user.userData.ssPassword,
                                cipherType: CipherType.CHACHA20_POLY1305,
                                ivCheck: false,
                                level: 0,
                            });
                            if (tempRes.isOk) {
                                await this.internalService.addUserToInbound(
                                    item.tag,
                                    user.userData.vlessUuid,
                                );
                            }
                            break;
                    }
                }
            }

            return {
                isOk: true,
                response: new AddUserResponseModel(true, null),
            };
        } catch (error) {
            this.logger.error(error);
            let message = '';
            if (error instanceof Error) {
                message = error.message;
            }
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new AddUserResponseModel(false, message),
            };
        } finally {
            this.logger.log(
                'Users addition took: ' +
                    ems(performance.now() - tm, {
                        extends: 'short',
                        includeMs: true,
                    }),
            );
        }
    }

    public async removeUsers(
        data: RemoveUsersRequestDto,
    ): Promise<ICommandResponse<RemoveUserResponseModel>> {
        const tm = performance.now();
        try {
            const inboundTags = this.internalService.getXtlsConfigInbounds();

            if (inboundTags.size === 0) {
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(true, null),
                };
            }

            this.logger.log(
                `Removing ${data.users.length} users from inbounds: ${Array.from(inboundTags).join(', ')}`,
            );

            const removeUsersResponse: Array<ISdkResponse<RemoveUserResponseModelFromSdk>> = [];

            for (const user of data.users) {
                const { userId, hashUuid } = user;

                const userIps = await this.getUserIps(userId);

                for (const tag of inboundTags) {
                    this.logger.debug(`Removing user: ${userId} from tag: ${tag}`);

                    const tempRes = await this.xtlsApi.handler.removeUser(tag, userId);

                    await this.internalService.removeUserFromInbound(tag, hashUuid);
                    removeUsersResponse.push(tempRes);
                }

                await this.destroyConnections(userIps);
            }

            if (removeUsersResponse.every((res) => !res.isOk)) {
                this.logger.error(JSON.stringify(removeUsersResponse, null, 2));
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(
                        false,
                        removeUsersResponse.find((res) => !res.isOk)?.message ?? null,
                    ),
                };
            }

            return {
                isOk: true,
                response: new RemoveUserResponseModel(true, null),
            };
        } catch (error: unknown) {
            this.logger.error(error);
            let message = '';
            if (error instanceof Error) {
                message = error.message;
            }
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new RemoveUserResponseModel(false, message),
            };
        } finally {
            this.logger.log(
                'Users removal took: ' +
                    ems(performance.now() - tm, {
                        extends: 'short',
                        includeMs: true,
                    }),
            );
        }
    }

    public async getInboundUsers(
        tag: string,
    ): Promise<ICommandResponse<GetInboundUsersResponseModel>> {
        try {
            // TODO: add a better way to return users (trojan, vless, etc)
            const response = await this.xtlsApi.handler.getInboundUsers(tag);

            if (!response.isOk || !response.data) {
                return {
                    isOk: false,
                    code: ERRORS.FAILED_TO_GET_INBOUND_USERS.code,
                    response: new GetInboundUsersResponseModel([]),
                };
            }

            return {
                isOk: true,
                response: new GetInboundUsersResponseModel(response.data.users),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                code: ERRORS.FAILED_TO_GET_INBOUND_USERS.code,
                response: new GetInboundUsersResponseModel([]),
            };
        }
    }

    public async getInboundUsersCount(
        tag: string,
    ): Promise<ICommandResponse<GetInboundUsersCountResponseModel>> {
        try {
            const response = await this.xtlsApi.handler.getInboundUsersCount(tag);

            if (!response.isOk || !response.data) {
                return {
                    isOk: false,
                    code: ERRORS.FAILED_TO_GET_INBOUND_USERS.code,
                    response: new GetInboundUsersCountResponseModel(0),
                };
            }

            return {
                isOk: true,
                response: new GetInboundUsersCountResponseModel(response.data),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: false,
                code: ERRORS.FAILED_TO_GET_INBOUND_USERS.code,
                response: new GetInboundUsersCountResponseModel(0),
            };
        }
    }

    public async dropUsersConnections(
        data: DropUsersConnectionsRequestDto,
    ): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            const { userIds } = data;

            for (const userId of userIds) {
                const userIps = await this.getUserIps(userId);
                await this.destroyConnections(userIps);
            }

            return {
                isOk: true,
                response: new GenericResponseModel(true),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: true,
                response: new GenericResponseModel(false),
            };
        }
    }

    public async dropIps(data: DropIpsRequestDto): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            const { ips } = data;

            await this.destroyConnections(ips);

            return {
                isOk: true,
                response: new GenericResponseModel(true),
            };
        } catch (error) {
            this.logger.error(error);
            return {
                isOk: true,
                response: new GenericResponseModel(false),
            };
        }
    }

    private async destroyConnections(ips: string[] | null): Promise<void> {
        if (!this.capNetAdminAvailable || !ips || ips.length === 0) {
            return;
        }

        for (const ip of ips) {
            try {
                const result = await killSockets({ src: ip, dst: ip, mode: 'or' });
                this.logger.debug(
                    `Destroyed connections for IP: ${ip} - ${JSON.stringify(result, null, 2)}`,
                );
            } catch (error) {
                this.logger.error(error);
            }
        }
    }

    private async getUserIps(userId: string): Promise<string[] | null> {
        try {
            if (!this.capNetAdminAvailable) {
                return null;
            }

            const userIps = await this.xtlsApi.stats.rawClient.getStatsOnlineIpList({
                name: `user>>>${userId}>>>online`,
                reset: true,
            });

            const ips = Object.keys(userIps.ips);

            return ips;
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
                return null;
            }

            this.logger.error(`Failed to get user IPs for user ${userId}:`, error);
            return null;
        }
    }
}
