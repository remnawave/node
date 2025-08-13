import ems from 'enhanced-ms';

import { Injectable, Logger } from '@nestjs/common';

import { HashedSet } from '@remnawave/hashed-set';

import { IHashPayload } from '@libs/contracts/constants';

@Injectable()
export class InternalService {
    private readonly logger = new Logger(InternalService.name);
    private xrayConfig: null | Record<string, unknown> = null;
    private emptyConfigHash: null | string = null;
    private inboundsHashMap: Map<string, HashedSet> = new Map();
    private xtlsConfigInbounds: string[] = [];

    constructor() {}

    public async getXrayConfig(): Promise<Record<string, unknown>> {
        if (!this.xrayConfig) {
            return {};
        }

        return this.xrayConfig;
    }

    public setXrayConfig(config: Record<string, unknown>): void {
        this.logger.debug('Setting new xray config');
        this.xrayConfig = config;
    }

    public extractUsersFromConfig(
        hashPayload: IHashPayload,
        newConfig: Record<string, unknown>,
    ): void {
        this.cleanup();

        this.emptyConfigHash = hashPayload.emptyConfig;
        this.xrayConfig = newConfig;

        this.logger.log(
            `Starting user extraction from inbounds... Hash payload: ${JSON.stringify(hashPayload)}`,
        );

        const start = performance.now();
        if (newConfig.inbounds && Array.isArray(newConfig.inbounds)) {
            for (const inbound of newConfig.inbounds) {
                const inboundTag: string = inbound.tag;

                if (!inboundTag || !hashPayload.inbounds.find((item) => item.tag === inboundTag)) {
                    continue;
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
            }

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                this.xtlsConfigInbounds.push(inboundTag);
                this.logger.log(`Inbound ${inboundTag} contains ${usersSet.size} user(s)`);
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
                this.logger.log('Detected changes in Xray Core base configuration');
                return true;
            }

            if (incomingHashPayload.inbounds.length !== this.inboundsHashMap.size) {
                this.logger.log('Number of Xray Core inbounds has changed');
                return true;
            }

            for (const [inboundTag, usersSet] of this.inboundsHashMap) {
                const incomingInbound = incomingHashPayload.inbounds.find(
                    (item) => item.tag === inboundTag,
                );

                if (!incomingInbound) {
                    this.logger.log(
                        `Inbound ${inboundTag} no longer exists in Xray Core configuration`,
                    );
                    return true;
                }

                if (usersSet.hash64String !== incomingInbound.hash) {
                    this.logger.log(
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

    public addUserToInbound(inboundTag: string, user: string): void {
        const usersSet = this.inboundsHashMap.get(inboundTag);

        if (!usersSet) {
            this.logger.warn(
                `Inbound ${inboundTag} not found in inboundsHashMap, creating new one`,
            );

            this.inboundsHashMap.set(inboundTag, new HashedSet([user]));

            return;
        }

        usersSet.add(user);
    }

    public removeUserFromInbound(inboundTag: string, user: string): void {
        const usersSet = this.inboundsHashMap.get(inboundTag);

        if (!usersSet) {
            return;
        }

        usersSet.delete(user);
    }

    public getXtlsConfigInbounds(): string[] {
        return this.xtlsConfigInbounds;
    }

    public cleanup(): void {
        this.inboundsHashMap.clear();
        this.xtlsConfigInbounds = [];
        this.xrayConfig = null;
        this.emptyConfigHash = null;
    }
}
