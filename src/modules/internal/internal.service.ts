import { getSemaphore } from '@henrygd/semaphore';
import ems from 'enhanced-ms';
import pMap from 'p-map';

import { Injectable, Logger } from '@nestjs/common';

import { HashedSet } from '@remnawave/hashed-set';

import { IHashPayload } from '@libs/contracts/constants';

/**
 * Sing-box user object interface.
 * Different inbound types may have different user structures.
 */
export interface ISingBoxUser {
    name: string;
    password?: string;
    uuid?: string;
    flow?: string;
    [key: string]: unknown;
}

/**
 * Sing-box inbound interface.
 */
interface ISingBoxInbound {
    type: string;
    tag: string;
    users?: ISingBoxUser[];
    [key: string]: unknown;
}

/**
 * Sing-box configuration interface.
 */
interface ISingBoxConfig {
    inbounds?: ISingBoxInbound[];
    [key: string]: unknown;
}

@Injectable()
export class InternalService {
    private readonly logger = new Logger(InternalService.name);
    private readonly mutex = getSemaphore();

    /** Current sing-box configuration */
    private singBoxConfig: ISingBoxConfig | null = null;

    /** Hash of empty config for comparison */
    private emptyConfigHash: string | null = null;

    /** Map of inbound tags to their user hash sets */
    private inboundsHashMap: Map<string, HashedSet> = new Map();

    /** Set of known inbound tags */
    private singBoxConfigInbounds: Set<string> = new Set();

    constructor() { }

    /**
     * Returns the current sing-box configuration.
     * Maintains original signature for API compatibility.
     */
    public async getXrayConfig(): Promise<Record<string, unknown>> {
        if (!this.singBoxConfig) {
            return {};
        }

        return this.singBoxConfig as Record<string, unknown>;
    }

    /**
     * Sets the sing-box configuration.
     * Maintains original method name for API compatibility.
     */
    public setXrayConfig(config: Record<string, unknown>): void {
        this.singBoxConfig = config as ISingBoxConfig;
    }

    /**
     * Extracts users from sing-box config inbounds and builds hash maps.
     * Adapted for sing-box format where users are in `inbound.users[]` array.
     *
     * @param hashPayload - Hash payload with inbound information
     * @param newConfig - New sing-box configuration
     */
    public async extractUsersFromConfig(
        hashPayload: IHashPayload,
        newConfig: Record<string, unknown>,
    ): Promise<void> {
        this.cleanup();

        this.emptyConfigHash = hashPayload.emptyConfig;
        this.singBoxConfig = newConfig as ISingBoxConfig;

        this.logger.log(
            `Starting user extraction from inbounds... Hash payload: ${JSON.stringify(hashPayload)}`,
        );

        const start = performance.now();
        const config = this.singBoxConfig;

        if (config.inbounds && Array.isArray(config.inbounds)) {
            const validTags = new Set(hashPayload.inbounds.map((item) => item.tag));

            await pMap(
                config.inbounds,
                async (inbound: ISingBoxInbound) => {
                    const inboundTag = inbound.tag;

                    if (!inboundTag || !validTags.has(inboundTag)) {
                        return;
                    }

                    const usersSet = new HashedSet();

                    // Sing-box stores users in `users` array directly
                    if (inbound.users && Array.isArray(inbound.users)) {
                        for (const user of inbound.users) {
                            // Use uuid for vless, password for others, or name as fallback
                            const userId = user.uuid || user.password || user.name;
                            if (userId) {
                                usersSet.add(userId);
                            }
                        }
                    }

                    this.inboundsHashMap.set(inboundTag, usersSet);
                },
                { concurrency: 20 },
            );

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                this.singBoxConfigInbounds.add(inboundTag);
                this.logger.log(`${inboundTag} has ${usersSet.size} users`);
            }
        }

        const result = ems(performance.now() - start, {
            extends: 'short',
            includeMs: true,
        });

        this.logger.log(`User extraction completed in ${result ? result : '0ms'}`);
    }

    /**
     * Checks if sing-box core needs to be restarted based on config hash comparison.
     *
     * @param incomingHashPayload - Incoming hash payload to compare against
     * @returns true if restart is needed, false otherwise
     */
    public isNeedRestartCore(incomingHashPayload: IHashPayload): boolean {
        const start = performance.now();
        try {
            if (!this.emptyConfigHash) {
                return true;
            }

            if (incomingHashPayload.emptyConfig !== this.emptyConfigHash) {
                this.logger.warn('Detected changes in Sing-box base configuration');
                return true;
            }

            if (incomingHashPayload.inbounds.length !== this.inboundsHashMap.size) {
                this.logger.warn('Number of Sing-box inbounds has changed');
                return true;
            }

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                const incomingInbound = incomingHashPayload.inbounds.find(
                    (item) => item.tag === inboundTag,
                );

                if (!incomingInbound) {
                    this.logger.warn(
                        `Inbound ${inboundTag} no longer exists in Sing-box configuration`,
                    );
                    return true;
                }

                if (usersSet.hash64String !== incomingInbound.hash) {
                    this.logger.warn(
                        `User configuration changed for inbound ${inboundTag} (${usersSet.hash64String} → ${incomingInbound.hash})`,
                    );
                    return true;
                }
            }

            this.logger.log('Sing-box configuration is up-to-date - no restart required');

            return false;
        } catch (error) {
            this.logger.error(`Failed to check if Sing-box restart is needed: ${error}`);
            return true;
        } finally {
            const result = ems(performance.now() - start, {
                extends: 'short',
                includeMs: true,
            });
            this.logger.log(`Configuration hash check completed in ${result ? result : '0ms'}`);
        }
    }

    /**
     * Adds a user to the hash set and updates sing-box config.
     * Maintains original signature for API compatibility.
     *
     * @param inboundTag - Tag of the inbound to add user to
     * @param user - User identifier (uuid or password)
     */
    public async addUserToInbound(inboundTag: string, user: string): Promise<void> {
        await this.mutex.acquire();

        try {
            const usersSet = this.inboundsHashMap.get(inboundTag);

            if (!usersSet) {
                this.logger.warn(
                    `Inbound ${inboundTag} not found in inboundsHashMap, creating new one`,
                );

                this.inboundsHashMap.set(inboundTag, new HashedSet([user]));

                return;
            }

            usersSet.add(user);
        } catch (error) {
            this.logger.error(`Failed to add user to inbound ${inboundTag}: ${error}`);
        } finally {
            this.mutex.release();
        }
    }

    /**
     * Removes a user from the hash set.
     * Maintains original signature for API compatibility.
     *
     * @param inboundTag - Tag of the inbound to remove user from
     * @param user - User identifier to remove
     */
    public async removeUserFromInbound(inboundTag: string, user: string): Promise<void> {
        await this.mutex.acquire();

        try {
            const usersSet = this.inboundsHashMap.get(inboundTag);

            if (!usersSet) {
                return;
            }

            usersSet.delete(user);

            if (usersSet.size === 0) {
                this.singBoxConfigInbounds.delete(inboundTag);
                this.inboundsHashMap.delete(inboundTag);

                this.logger.warn(`Inbound ${inboundTag} has no users, clearing inboundsHashMap.`);
            }
        } catch (error) {
            this.logger.error(`Failed to remove user from inbound ${inboundTag}: ${error}`);
        } finally {
            this.mutex.release();
        }
    }

    /**
     * Adds a user object to the sing-box config for a specific inbound.
     * This modifies the actual config that will be served to sing-box.
     *
     * @param inboundTag - Tag of the inbound to add user to
     * @param userData - User data object to add
     * @returns true if user was added successfully
     */
    public async addUserToConfig(inboundTag: string, userData: ISingBoxUser): Promise<boolean> {
        await this.mutex.acquire();

        try {
            if (!this.singBoxConfig?.inbounds) {
                this.logger.error('No sing-box config or inbounds available');
                return false;
            }

            const inbound = this.singBoxConfig.inbounds.find((ib) => ib.tag === inboundTag);

            if (!inbound) {
                this.logger.error(`Inbound ${inboundTag} not found in config`);
                return false;
            }

            // Initialize users array if not present
            if (!inbound.users) {
                inbound.users = [];
            }

            // Remove existing user with same name if present
            const existingIndex = inbound.users.findIndex((u) => u.name === userData.name);
            if (existingIndex !== -1) {
                inbound.users.splice(existingIndex, 1);
                this.logger.debug(`Removed existing user ${userData.name} from ${inboundTag}`);
            }

            // Add new user
            inbound.users.push(userData);

            this.logger.log(`Added user ${userData.name} to inbound ${inboundTag}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to add user to config for inbound ${inboundTag}: ${error}`);
            return false;
        } finally {
            this.mutex.release();
        }
    }

    /**
     * Removes a user from the sing-box config for a specific inbound.
     *
     * @param inboundTag - Tag of the inbound to remove user from
     * @param username - Name of the user to remove
     * @returns true if user was removed successfully
     */
    public async removeUserFromConfig(inboundTag: string, username: string): Promise<boolean> {
        await this.mutex.acquire();

        try {
            if (!this.singBoxConfig?.inbounds) {
                this.logger.error('No sing-box config or inbounds available');
                return false;
            }

            const inbound = this.singBoxConfig.inbounds.find((ib) => ib.tag === inboundTag);

            if (!inbound) {
                this.logger.warn(`Inbound ${inboundTag} not found in config`);
                return false;
            }

            if (!inbound.users || !Array.isArray(inbound.users)) {
                this.logger.warn(`Inbound ${inboundTag} has no users array`);
                return false;
            }

            const userIndex = inbound.users.findIndex((u) => u.name === username);

            if (userIndex === -1) {
                this.logger.warn(`User ${username} not found in inbound ${inboundTag}`);
                return false;
            }

            inbound.users.splice(userIndex, 1);

            this.logger.log(`Removed user ${username} from inbound ${inboundTag}`);
            return true;
        } catch (error) {
            this.logger.error(
                `Failed to remove user from config for inbound ${inboundTag}: ${error}`,
            );
            return false;
        } finally {
            this.mutex.release();
        }
    }

    /**
     * Gets users from a specific inbound in the config.
     *
     * @param inboundTag - Tag of the inbound
     * @returns Array of user objects or empty array
     */
    public getUsersFromConfig(inboundTag: string): ISingBoxUser[] {
        if (!this.singBoxConfig?.inbounds) {
            return [];
        }

        const inbound = this.singBoxConfig.inbounds.find((ib) => ib.tag === inboundTag);

        if (!inbound?.users) {
            return [];
        }

        return inbound.users;
    }

    /**
     * Gets the set of known inbound tags.
     * Maintains original method name for API compatibility.
     */
    public getXtlsConfigInbounds(): Set<string> {
        return this.singBoxConfigInbounds;
    }

    /**
     * Gets all inbounds from the current config.
     * Returns array of inbound objects with tag and type.
     */
    public getAllConfigInbounds(): Array<{ tag: string; type: string }> {
        if (!this.singBoxConfig?.inbounds) {
            return [];
        }

        return this.singBoxConfig.inbounds
            .filter((ib) => ib.tag && ib.type)
            .map((ib) => ({ tag: ib.tag, type: ib.type }));
    }

    /**
     * Adds an inbound tag to the known inbounds set.
     * Maintains original method name for API compatibility.
     */
    public addXtlsConfigInbound(inboundTag: string): void {
        this.singBoxConfigInbounds.add(inboundTag);
    }

    /**
     * Cleans up all stored state.
     */
    public cleanup(): void {
        this.logger.log('Cleaning up internal service.');

        this.inboundsHashMap.clear();
        this.singBoxConfigInbounds.clear();
        this.singBoxConfig = null;
        this.emptyConfigHash = null;
    }
}
