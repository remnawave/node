import { Injectable, Logger } from '@nestjs/common';

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
    GetInboundUsersCountResponseModel,
    GetInboundUsersResponseModel,
    AddUserResponseModel,
    RemoveUserResponseModel,
} from './models';
import {
    AddUserRequestDto,
    AddUsersRequestDto,
    RemoveUserRequestDto,
    RemoveUsersRequestDto,
} from './dtos';
import { InternalService } from '../internal/internal.service';

@Injectable()
export class HandlerService {
    private readonly logger = new Logger(HandlerService.name);

    constructor(
        @InjectXtls() private readonly xtlsApi: XtlsApi,
        private readonly internalService: InternalService,
    ) {}

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

            for (const tag of inboundTags) {
                this.logger.debug(`Removing user: ${username} from tag: ${tag}`);

                const tempRes = await this.xtlsApi.handler.removeUser(tag, username);

                await this.internalService.removeUserFromInbound(tag, hashData.vlessUuid);
                response.push(tempRes);
            }

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
        try {
            const { affectedInboundTags, users } = data;
            const response: Array<ISdkResponse<AddUserResponseModelFromSdk>> = [];

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
                            response.push(tempRes);
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
                            response.push(tempRes);
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

    public async removeUsers(
        data: RemoveUsersRequestDto,
    ): Promise<ICommandResponse<RemoveUserResponseModel>> {
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

            for (const user of data.users) {
                const { userId, hashUuid } = user;
                const response: Array<ISdkResponse<RemoveUserResponseModelFromSdk>> = [];

                for (const tag of inboundTags) {
                    this.logger.debug(`Removing user: ${userId} from tag: ${tag}`);

                    const tempRes = await this.xtlsApi.handler.removeUser(tag, userId);

                    await this.internalService.removeUserFromInbound(tag, hashUuid);
                    response.push(tempRes);
                }

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
}
