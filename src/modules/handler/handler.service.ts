import { Injectable, Logger } from '@nestjs/common';

import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';

import {
    GetInboundUsersCountResponseModel,
    GetInboundUsersResponseModel,
    AddUserResponseModel,
    RemoveUserResponseModel,
} from './models';
import { IRemoveUserRequest, TAddUserRequest, TUserData } from './interfaces';
import { InternalService, ISingBoxUser } from '../internal/internal.service';
import { XrayService } from '../xray-core/xray.service';

/**
 * Service for managing users in sing-box inbounds.
 * Replaces xtls-sdk gRPC calls with config file modifications.
 */
@Injectable()
export class HandlerService {
    private readonly logger = new Logger(HandlerService.name);

    constructor(
        private readonly internalService: InternalService,
        private readonly xrayService: XrayService,
    ) { }

    /**
     * Adds a user to sing-box inbounds.
     * Modifies the config and triggers sing-box restart.
     * User is added to ALL inbounds that support the user type.
     *
     * @param data - User data and hash information
     */
    public async addUser(data: TAddUserRequest): Promise<ICommandResponse<AddUserResponseModel>> {
        try {
            const { data: requestData, hashData } = data;
            const errors: string[] = [];
            let hasSuccess = false;

            // Get ALL inbounds from the config
            const allInbounds = this.internalService.getAllConfigInbounds();

            if (allInbounds.length === 0) {
                this.logger.warn('No inbounds found in config');
                return {
                    isOk: true,
                    response: new AddUserResponseModel(false, 'No inbounds found in config'),
                };
            }

            // Register all inbound tags
            for (const inbound of allInbounds) {
                this.internalService.addXtlsConfigInbound(inbound.tag);
            }

            // Get username from the first request item
            const username = requestData[0]?.username;

            // Remove existing user from all inbounds first
            if (username) {
                for (const inbound of allInbounds) {
                    this.logger.debug(`Removing existing user: ${username} from tag: ${inbound.tag}`);
                    await this.internalService.removeUserFromConfig(inbound.tag, username);

                    const userIdToRemove = hashData.prevVlessUuid || hashData.vlessUuid;
                    await this.internalService.removeUserFromInbound(inbound.tag, userIdToRemove);
                }
            }

            // Add user to ALL inbounds with appropriate format for each inbound type
            for (const inbound of allInbounds) {
                // Find matching user data for this inbound type, or use first available
                const userData = requestData.find((item) =>
                    this.isUserTypeCompatibleWithInbound(item.type, inbound.type)
                ) || requestData[0];

                if (!userData) {
                    continue;
                }

                this.logger.debug(`Adding user: ${userData.username} to inbound: ${inbound.tag} (type: ${inbound.type})`);

                const singBoxUser = this.mapUserToSingBoxFormatByInboundType(userData, inbound.type);

                if (!singBoxUser) {
                    this.logger.debug(`Skipping inbound ${inbound.tag}: incompatible user type`);
                    continue;
                }

                const success = await this.internalService.addUserToConfig(inbound.tag, singBoxUser);

                if (success) {
                    await this.internalService.addUserToInbound(inbound.tag, hashData.vlessUuid);
                    hasSuccess = true;
                } else {
                    errors.push(`Failed to add user ${userData.username} to inbound ${inbound.tag}`);
                }
            }

            if (!hasSuccess) {
                const errorMessage = errors.join('; ') || 'Failed to add any users';
                this.logger.error('Error adding users: ' + errorMessage);
                return {
                    isOk: true,
                    response: new AddUserResponseModel(false, errorMessage),
                };
            }

            // Restart sing-box to apply changes
            const restartResult = await this.xrayService.restartProcess();
            if (!restartResult.success) {
                this.logger.error(`Failed to restart sing-box: ${restartResult.error}`);
                return {
                    isOk: true,
                    response: new AddUserResponseModel(false, restartResult.error),
                };
            }

            return {
                isOk: true,
                response: new AddUserResponseModel(true, null),
            };
        } catch (error) {
            this.logger.error(error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new AddUserResponseModel(false, message),
            };
        }
    }

    /**
     * Removes a user from all sing-box inbounds.
     *
     * @param data - Username and hash data
     */
    public async removeUser(
        data: IRemoveUserRequest,
    ): Promise<ICommandResponse<RemoveUserResponseModel>> {
        try {
            const { username, hashData } = data;

            const inboundTags = this.internalService.getXtlsConfigInbounds();

            if (inboundTags.size === 0) {
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(true, null),
                };
            }

            let hasSuccess = false;

            for (const tag of inboundTags) {
                this.logger.debug(`Removing user: ${username} from tag: ${tag}`);

                const success = await this.internalService.removeUserFromConfig(tag, username);
                if (success) {
                    hasSuccess = true;
                }

                await this.internalService.removeUserFromInbound(tag, hashData.vlessUuid);
            }

            if (!hasSuccess) {
                this.logger.warn(`User ${username} was not found in any inbound`);
                // Still return success as the user doesn't exist
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(true, null),
                };
            }

            // Restart sing-box to apply changes
            const restartResult = await this.xrayService.restartProcess();
            if (!restartResult.success) {
                this.logger.error(`Failed to restart sing-box: ${restartResult.error}`);
                return {
                    isOk: true,
                    response: new RemoveUserResponseModel(false, restartResult.error),
                };
            }

            return {
                isOk: true,
                response: new RemoveUserResponseModel(true, null),
            };
        } catch (error: unknown) {
            this.logger.error(error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                isOk: false,
                code: ERRORS.INTERNAL_SERVER_ERROR.code,
                response: new RemoveUserResponseModel(false, message),
            };
        }
    }

    /**
     * Gets users from a specific inbound.
     *
     * @param tag - Inbound tag
     */
    public async getInboundUsers(
        tag: string,
    ): Promise<ICommandResponse<GetInboundUsersResponseModel>> {
        try {
            const users = this.internalService.getUsersFromConfig(tag);

            // Map sing-box users to the expected IInboundUser format
            const usersList = users.map((user) => ({
                username: user.name,
                level: 0, // Default level for sing-box
                protocol: 'unknown', // Protocol type would need to be tracked separately
            }));

            return {
                isOk: true,
                response: new GetInboundUsersResponseModel(usersList),
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

    /**
     * Gets the count of users in a specific inbound.
     *
     * @param tag - Inbound tag
     */
    public async getInboundUsersCount(
        tag: string,
    ): Promise<ICommandResponse<GetInboundUsersCountResponseModel>> {
        try {
            const users = this.internalService.getUsersFromConfig(tag);

            return {
                isOk: true,
                response: new GetInboundUsersCountResponseModel(users.length),
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

    /**
     * Maps user data from Xray format to sing-box format.
     *
     * @param userData - User data in Xray format
     * @returns Sing-box user object or null if type is unsupported
     */
    private mapUserToSingBoxFormat(userData: TUserData): ISingBoxUser | null {
        const baseUser = { name: userData.username };

        switch (userData.type) {
            case 'vless':
                return {
                    ...baseUser,
                    uuid: userData.uuid,
                    flow: userData.flow || undefined,
                };

            case 'trojan':
                return {
                    ...baseUser,
                    password: userData.password,
                };

            case 'shadowsocks':
                return {
                    ...baseUser,
                    password: userData.password,
                };

            case 'shadowsocks2022':
                return {
                    ...baseUser,
                    password: userData.key,
                };

            case 'hysteria2':
                return {
                    ...baseUser,
                    password: userData.password,
                };

            case 'shadowtls':
                return {
                    ...baseUser,
                    password: userData.password,
                };

            case 'naive':
                return {
                    name: userData.username, // For naive, username is used differently
                    password: userData.password,
                };

            case 'anytls':
                return {
                    ...baseUser,
                    password: userData.password,
                };

            case 'http':
                // HTTP proxy has different user format
                return {
                    name: userData.http_username,
                    password: userData.http_password,
                };

            case 'socks':
                // SOCKS proxy has different user format
                return {
                    name: userData.socks_username,
                    password: userData.socks_password,
                };

            default:
                this.logger.warn(`Unknown user type: ${(userData as TUserData).type}`);
                return null;
        }
    }

    /**
     * Checks if a user type is compatible with an inbound type.
     * Used to determine which user data to use for each inbound.
     */
    private isUserTypeCompatibleWithInbound(userType: string, inboundType: string): boolean {
        const compatibilityMap: Record<string, string[]> = {
            'vless': ['vless'],
            'trojan': ['trojan'],
            'shadowsocks': ['shadowsocks'],
            'shadowsocks2022': ['shadowsocks'],
            'hysteria2': ['hysteria2'],
            'shadowtls': ['shadowtls'],
            'naive': ['naive'],
            'anytls': ['anytls'],
            'http': ['http'],
            'socks': ['socks'],
        };

        const compatibleInbounds = compatibilityMap[userType];
        return compatibleInbounds?.includes(inboundType) ?? false;
    }

    /**
     * Maps user data to sing-box format based on the inbound type.
     * Creates appropriate user object for each inbound type.
     */
    private mapUserToSingBoxFormatByInboundType(userData: TUserData, inboundType: string): ISingBoxUser | null {
        const baseUser = { name: userData.username };

        // Map inbound type to the appropriate user format
        switch (inboundType) {
            case 'vless':
                // VLESS requires uuid
                if (userData.type === 'vless' && 'uuid' in userData) {
                    return {
                        ...baseUser,
                        uuid: userData.uuid,
                        flow: userData.flow || undefined,
                    };
                }
                return null;

            case 'trojan':
                // Trojan uses password
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'shadowsocks':
                // Shadowsocks uses password or key
                if (userData.type === 'shadowsocks2022' && 'key' in userData) {
                    return {
                        ...baseUser,
                        password: userData.key,
                    };
                }
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'hysteria2':
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'shadowtls':
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'naive':
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'anytls':
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'http':
                if (userData.type === 'http' && 'http_username' in userData) {
                    return {
                        name: userData.http_username,
                        password: userData.http_password,
                    };
                }
                // Fallback to password-based user
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            case 'socks':
                if (userData.type === 'socks' && 'socks_username' in userData) {
                    return {
                        name: userData.socks_username,
                        password: userData.socks_password,
                    };
                }
                // Fallback to password-based user
                if ('password' in userData) {
                    return {
                        ...baseUser,
                        password: userData.password,
                    };
                }
                return null;

            default:
                this.logger.debug(`Unknown inbound type: ${inboundType}`);
                return null;
        }
    }
}
