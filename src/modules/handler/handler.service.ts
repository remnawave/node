import { Injectable, Logger } from '@nestjs/common';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { ICommandResponse } from '../../common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';
import { TAddUserRequest } from './interfaces';
import { AddUserResponseModel } from './models';
import { GetInboundUsersResponseModel } from './models';
import { XtlsApi } from '@remnawave/xtls-sdk';
import { IRemoveUserRequest } from './interfaces';
import { RemoveUserResponseModel } from './models';
import { GetInboundUsersCountResponseModel } from './models';

@Injectable()
export class HandlerService {
    private readonly logger = new Logger(HandlerService.name);

    constructor(@InjectXtls() private readonly xtlsApi: XtlsApi) {}

    public async addUser(data: TAddUserRequest): Promise<ICommandResponse<AddUserResponseModel>> {
        try {
            const { data: requestData } = data;

            let res = null;

            switch (requestData.type) {
                case 'trojan':
                    res = await this.xtlsApi.handler.addTrojanUser({
                        tag: requestData.tag,
                        username: requestData.username,
                        password: requestData.password,
                        level: requestData.level,
                    });
                    break;
                case 'vless':
                    res = await this.xtlsApi.handler.addVlessUser({
                        tag: requestData.tag,
                        username: requestData.username,
                        uuid: requestData.uuid,
                        flow: requestData.flow,
                        level: requestData.level,
                    });
                    break;
                case 'shadowsocks':
                    res = await this.xtlsApi.handler.addShadowsocksUser({
                        tag: requestData.tag,
                        username: requestData.username,
                        password: requestData.password,
                        cipherType: requestData.cipherType,
                        ivCheck: requestData.ivCheck,
                        level: requestData.level,
                    });
                    break;
                case 'shadowsocks2022':
                    res = await this.xtlsApi.handler.addShadowsocks2022User({
                        tag: requestData.tag,
                        username: requestData.username,
                        key: requestData.key,
                        level: requestData.level,
                    });
                    break;
                case 'socks':
                    res = await this.xtlsApi.handler.addSocksUser({
                        tag: requestData.tag,
                        username: requestData.username,
                        socks_username: requestData.socks_username,
                        socks_password: requestData.socks_password,
                        level: requestData.level,
                    });
                    break;
                case 'http':
                    res = await this.xtlsApi.handler.addHttpUser({
                        tag: requestData.tag,
                        username: requestData.username,
                        http_username: requestData.http_username,
                        http_password: requestData.http_password,
                        level: requestData.level,
                    });
                    break;
            }

            if (!res.data?.isAdded || !res.isOk) {
                return {
                    isOk: true,
                    response: new AddUserResponseModel(false, res.message ?? null),
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
