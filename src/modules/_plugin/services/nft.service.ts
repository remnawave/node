import { hasCapNetAdmin } from 'sockdestroy';
import { NftManager } from 'nftables-napi';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import { ICommandResponse } from '@common/types/command-response.type';

import { GenericResponseModel } from '../models/generic.response.model';
import { NFT_TABLES_CONSTANTS } from '../constants/nfttables.contants';
import { BlockIpsRequestDto, UnblockIpsRequestDto } from '../dtos';
import { DropConnectionsEvent } from '../events/drop-connections';
import { PluginStateService } from './plugin-state.service';

@Injectable()
export class NftService implements OnModuleDestroy, OnModuleInit {
    private readonly logger = new Logger(NftService.name);
    private nftManager: NftManager | null = null;
    private available = false;

    constructor(
        private readonly state: PluginStateService,
        private readonly eventBus: EventBus,
    ) {}

    get isAvailable(): boolean {
        return this.available;
    }

    public async onModuleInit(): Promise<void> {
        const capNetAdmin = hasCapNetAdmin();

        if (!capNetAdmin) return;

        this.state.setPlugins({
            connectionDrop: true,
            ingressFilter: false,
            torrentBlocker: false,
            egressFilter: false,
        });

        try {
            this.nftManager = new NftManager({
                tableName: NFT_TABLES_CONSTANTS.TABLE_NAME,
                ingressAddrSets: [
                    NFT_TABLES_CONSTANTS.INGRESS_FILTER_IP_SET_NAME,
                    NFT_TABLES_CONSTANTS.TORRENT_BLOCKER_SET_NAME,
                ],
                egressAddrSets: [NFT_TABLES_CONSTANTS.EGRESS_FILTER_IP_SET_NAME],
                egressPortSets: [NFT_TABLES_CONSTANTS.EGRESS_FILTER_PORT_SET_NAME],
            });
            await this.recreateTables();

            this.available = true;

            this.state.setPlugins({
                connectionDrop: true,
                ingressFilter: true,
                torrentBlocker: true,
                egressFilter: true,
            });
        } catch (error) {
            this.logger.error(error);
            this.logger.warn('[PLUGIN] NftManager initialization failed.');
        }

        this.logAvailablePlugins();
    }

    public async onModuleDestroy(): Promise<void> {
        try {
            if (this.nftManager) {
                await this.nftManager.deleteTable();
            }
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async syncIngressFilter(ips: string[]): Promise<void> {
        if (!this.nftManager) return;
        if (ips.length > 0) {
            await this.nftManager.addAddresses({
                ips,
                set: NFT_TABLES_CONSTANTS.INGRESS_FILTER_IP_SET_NAME,
            });
        }
    }

    public async syncEgressFilter({
        ips,
        ports,
    }: {
        ips: string[];
        ports: number[];
    }): Promise<void> {
        if (!this.nftManager) return;
        if (ips.length > 0) {
            await this.nftManager.addAddresses({
                ips,
                set: NFT_TABLES_CONSTANTS.EGRESS_FILTER_IP_SET_NAME,
            });
        }
        if (ports.length > 0) {
            await this.nftManager.addPorts({
                ports,
                set: NFT_TABLES_CONSTANTS.EGRESS_FILTER_PORT_SET_NAME,
            });
        }
    }

    public async blockIp(ip: string, timeoutSeconds: number): Promise<void> {
        if (!this.nftManager) return;
        await this.nftManager.addAddress({
            ip,
            set: NFT_TABLES_CONSTANTS.TORRENT_BLOCKER_SET_NAME,
            timeout: timeoutSeconds === 0 ? undefined : timeoutSeconds,
        });
        this.eventBus.publish(new DropConnectionsEvent([ip]));
    }

    public async recreateTables(): Promise<void> {
        if (!this.nftManager) return;
        await this.nftManager.createTable();
    }

    private logAvailablePlugins(): void {
        const plugins = this.state.plugins;
        [
            { name: 'Ingress Filter', enabled: plugins.ingressFilter },
            { name: 'Egress Filter', enabled: plugins.egressFilter },
            { name: 'Torrent Blocker', enabled: plugins.torrentBlocker },
            { name: 'Connection Drop', enabled: plugins.connectionDrop },
        ].forEach((plugin) => {
            if (plugin.enabled) {
                this.logger.log(`[PLUGIN] ${plugin.name}: available`);
            } else {
                this.logger.warn(`[PLUGIN] ${plugin.name}: not available`);
            }
        });
    }

    public async blockIpsController(
        data: BlockIpsRequestDto,
    ): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            if (!this.nftManager) {
                return {
                    isOk: true,
                    response: new GenericResponseModel(false),
                };
            }

            const { ips } = data;
            for (const ip of ips) {
                await this.blockIp(ip.ip, ip.timeout);
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

    public async unblockIpsController(
        data: UnblockIpsRequestDto,
    ): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            if (!this.nftManager) {
                return {
                    isOk: true,
                    response: new GenericResponseModel(false),
                };
            }

            const { ips } = data;

            await this.nftManager.removeAddresses({
                ips,
                set: NFT_TABLES_CONSTANTS.TORRENT_BLOCKER_SET_NAME,
            });

            await this.nftManager.removeAddresses({
                ips,
                set: NFT_TABLES_CONSTANTS.INGRESS_FILTER_IP_SET_NAME,
            });

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

    public async recreateTablesController(): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            if (!this.nftManager) {
                return {
                    isOk: true,
                    response: new GenericResponseModel(false),
                };
            }

            await this.nftManager.createTable();

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
}
