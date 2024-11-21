import { Injectable, Logger } from '@nestjs/common';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { ICommandResponse } from '../../common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';
import { TAddUserRequest } from './interfaces';
import { AddUserResponseModel } from './models';
import { AddUserResponseModel as AddUserResponseModelFromSdk } from '@remnawave/xtls-sdk/build/src/handler/models/add-user/add-user.response.model';
import { GetInboundUsersResponseModel } from './models';
import { XtlsApi } from '@remnawave/xtls-sdk';
import { IRemoveUserRequest } from './interfaces';
import { RemoveUserResponseModel } from './models';
import { GetInboundUsersCountResponseModel } from './models';
import { ISdkResponse } from '@remnawave/xtls-sdk/build/src/common/types';

@Injectable()
export class HandlerService {
    private readonly logger = new Logger(HandlerService.name);

    constructor(@InjectXtls() private readonly xtlsApi: XtlsApi) {}

    public async addUser(data: TAddUserRequest): Promise<ICommandResponse<AddUserResponseModel>> {
        try {
            const { data: requestData } = data;
            const response: Array<ISdkResponse<AddUserResponseModelFromSdk>> = [];

            for (const item of requestData) {
                let tempRes = null;
                switch (item.type) {
                    case 'trojan':
                        tempRes = await this.xtlsApi.handler.addTrojanUser({
                            tag: item.tag,
                            username: item.username,
                            password: item.password,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                    case 'vless':
                        tempRes = await this.xtlsApi.handler.addVlessUser({
                            tag: item.tag,
                            username: item.username,
                            uuid: item.uuid,
                            flow: item.flow,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                    case 'shadowsocks':
                        tempRes = await this.xtlsApi.handler.addShadowsocksUser({
                            tag: item.tag,
                            username: item.username,
                            password: item.password,
                            cipherType: item.cipherType,
                            ivCheck: item.ivCheck,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                    case 'shadowsocks2022':
                        tempRes = await this.xtlsApi.handler.addShadowsocks2022User({
                            tag: item.tag,
                            username: item.username,
                            key: item.key,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                    case 'socks':
                        tempRes = await this.xtlsApi.handler.addSocksUser({
                            tag: item.tag,
                            username: item.username,
                            socks_username: item.socks_username,
                            socks_password: item.socks_password,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                    case 'http':
                        tempRes = await this.xtlsApi.handler.addHttpUser({
                            tag: item.tag,
                            username: item.username,
                            http_username: item.http_username,
                            http_password: item.http_password,
                            level: item.level,
                        });
                        response.push(tempRes);
                        break;
                }
            }

            if (!response.every((res) => !res.data?.isAdded || !res.isOk)) {
                return {
                    isOk: true,
                    response: new AddUserResponseModel(
                        false,
                        response.find((res) => !res.data?.isAdded || !res.isOk)?.message ?? null,
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

    public async removeUser(
        data: IRemoveUserRequest,
    ): Promise<ICommandResponse<RemoveUserResponseModel>> {
        try {
            const { username, tag } = data;
            const response = await this.xtlsApi.handler.removeUser(tag, username);

            if (!response.isOk || !response.data?.isDeleted) {
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(false, response.message ?? null),
                };
            }

            return {
                isOk: true,
                response: new RemoveUserResponseModel(true, null),
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
                response: new RemoveUserResponseModel(false, message),
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
