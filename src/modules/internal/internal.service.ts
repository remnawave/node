import { getSemaphore } from '@henrygd/semaphore';
import ems from 'enhanced-ms';
import pMap from 'p-map';

import { Injectable, Logger } from '@nestjs/common';

import { HashedSet } from '@remnawave/hashed-set';

import { IHashPayload } from '@libs/contracts/constants';

@Injectable()
export class InternalService {
    private readonly logger = new Logger(InternalService.name);
    private readonly mutex = getSemaphore();

    private xrayConfig: null | Record<string, unknown> = null;
    private emptyConfigHash: null | string = null;
    private inboundsHashMap: Map<string, HashedSet> = new Map();
    private xtlsConfigInbounds: Set<string> = new Set();

    constructor() {}

    public async getXrayConfig(): Promise<Record<string, unknown>> {
        if (!this.xrayConfig) {
            return {};
        }

        return this.xrayConfig;
    }

    public setXrayConfig(config: Record<string, unknown>): void {
        this.xrayConfig = config;
    }

    public async extractUsersFromConfig(
        hashPayload: IHashPayload,
        newConfig: Record<string, unknown>,
    ): Promise<void> {
        this.cleanup();

        this.emptyConfigHash = hashPayload.emptyConfig;
        this.xrayConfig = newConfig;

        this.logger.log(
            `Starting user extraction from inbounds... Hash payload: ${JSON.stringify(hashPayload)}`,
        );

        const start = performance.now();
        if (newConfig.inbounds && Array.isArray(newConfig.inbounds)) {
            const validTags = new Set(hashPayload.inbounds.map((item) => item.tag));

            await pMap(
                newConfig.inbounds,
                async (inbound) => {
                    const inboundTag: string = inbound.tag;

                    if (!inboundTag || !validTags.has(inboundTag)) {
                        return;
                    }

                    const usersSet = new HashedSet();

                    if (
                        inbound.settings &&
                        inbound.settings.clients &&
                        Array.isArray(inbound.settings.clients)
                    ) {
                        for (const client of inbound.settings.clients) {
                            if (client.id) {
                                usersSet.add(client.id);
                            }
                        }
                    }

                    this.inboundsHashMap.set(inboundTag, usersSet);
                },
                { concurrency: 20 },
            );

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                this.xtlsConfigInbounds.add(inboundTag);
                this.logger.log(`${inboundTag} has ${usersSet.size} users`);
            }
        }

        const result = ems(performance.now() - start, {
            extends: 'short',
            includeMs: true,
        });

        this.logger.log(`User extraction completed in ${result ? result : '0ms'}`);
    }

    public isNeedRestartCore(incomingHashPayload: IHashPayload): boolean {
        const start = performance.now();
        try {
            if (!this.emptyConfigHash) {
                return true;
            }

            if (incomingHashPayload.emptyConfig !== this.emptyConfigHash) {
                this.logger.warn('Detected changes in Xray Core base configuration');
                return true;
            }

            if (incomingHashPayload.inbounds.length !== this.inboundsHashMap.size) {
                this.logger.warn('Number of Xray Core inbounds has changed');
                return true;
            }

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                const incomingInbound = incomingHashPayload.inbounds.find(
                    (item) => item.tag === inboundTag,
                );

                if (!incomingInbound) {
                    this.logger.warn(
                        `Inbound ${inboundTag} no longer exists in Xray Core configuration`,
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

            this.logger.log('Xray Core configuration is up-to-date - no restart required');

            return false;
        } catch (error) {
            this.logger.error(`Failed to check if Xray Core restart is needed: ${error}`);
            return true;
        } finally {
            const result = ems(performance.now() - start, {
                extends: 'short',
                includeMs: true,
            });
            this.logger.log(`Configuration hash check completed in ${result ? result : '0ms'}`);
        }
    }

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

    public async removeUserFromInbound(inboundTag: string, user: string): Promise<void> {
        await this.mutex.acquire();

        try {
            const usersSet = this.inboundsHashMap.get(inboundTag);

            if (!usersSet) {
                return;
            }

            usersSet.delete(user);

            if (usersSet.size === 0) {
                this.xtlsConfigInbounds.delete(inboundTag);
                this.inboundsHashMap.delete(inboundTag);

                this.logger.warn(`Inbound ${inboundTag} has no users, clearing inboundsHashMap.`);
            }
        } catch (error) {
            this.logger.error(`Failed to remove user from inbound ${inboundTag}: ${error}`);
        } finally {
            this.mutex.release();
        }
    }

    public getXtlsConfigInbounds(): Set<string> {
        return this.xtlsConfigInbounds;
    }

    public addXtlsConfigInbound(inboundTag: string): void {
        this.xtlsConfigInbounds.add(inboundTag);
    }

    public cleanup(): void {
        this.inboundsHashMap.clear();
        this.xtlsConfigInbounds.clear();
        this.xrayConfig = null;
        this.emptyConfigHash = null;
    }
}
