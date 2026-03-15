import { hasher } from 'node-object-hash';

import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { NodePluginSchema, type TNodePlugin } from '@remnawave/node-plugins';

import { ICommandResponse } from '@common/types/command-response.type';
import { XRAY_TORRENT_BLOCKER_OUTBOUND_TAG } from '@libs/contracts/constants';

import { TorrentBlockerReportsResponseModel } from './models/torrent-blocker-reports.response.model';
import { RemoveOutboundCommand } from '../handler/commands/remove-outbound/remove-outbound.command';
import { PluginStateService } from './services/plugin-state.service';
import { StopXrayCommand } from '../xray-core/commands/stop-xray';
import { NftService } from './services/nft.service';
import { GenericResponseModel } from './models';
import { SyncRequestDto } from './dtos';

@Injectable()
export class PluginService {
    private readonly logger = new Logger(PluginService.name);
    private readonly hashFn = hasher({ trim: true, sort: false }).hash;

    constructor(
        private readonly state: PluginStateService,
        private readonly nftService: NftService,
        private readonly commandBus: CommandBus,
    ) {}

    public async sync(body: SyncRequestDto): Promise<ICommandResponse<GenericResponseModel>> {
        try {
            const { plugin } = body;

            if (!plugin) {
                if (!this.state.hasActivePlugin()) {
                    return { isOk: true, response: new GenericResponseModel(false) };
                }

                this.logger.log(
                    '[PLUGIN] Received empty plugins, but there is an active plugin. Cleaning up...',
                );
                await this.resetPlugins();
                await this.commandBus.execute(
                    new StopXrayCommand({
                        withOnlineCheck: true,
                        withPluginCleanup: false,
                    }),
                );

                return { isOk: true, response: new GenericResponseModel(true) };
            }

            const configHash = this.hashFn(plugin.config);

            if (!this.state.isConfigChanged(configHash)) {
                this.logger.debug('[PLUGIN] Config unchanged. Skipping sync.');
                return { isOk: true, response: new GenericResponseModel(true) };
            }

            const parsed = await NodePluginSchema.safeParseAsync(plugin.config);

            if (!parsed.success) {
                this.logger.error(`[PLUGIN] Invalid config: ${JSON.stringify(parsed.error)}`);
                await this.resetPlugins();
                await this.commandBus.execute(
                    new StopXrayCommand({
                        withOnlineCheck: true,
                        withPluginCleanup: false,
                    }),
                );
                return { isOk: true, response: new GenericResponseModel(false) };
            }

            const currentTorrentBlocker = this.state.torrentBlocker.isEnabled;
            const currentTorrentBlockerIncludeRuleTags = new Set(
                this.state.torrentBlocker.includeRuleTagsSet,
            );

            const pluginData = parsed.data;

            const sharedMap = new Map(
                pluginData.sharedLists
                    .filter((list) => list.type === 'ipList')
                    .map((list) => [list.name, list.items]),
            );

            this.state.resetState();
            this.state.cleanUpActivePlugin();
            await this.nftService.recreateTables();

            this.syncConnectionDrop(pluginData, sharedMap);
            this.syncTorrentBlocker(pluginData, sharedMap);

            await this.syncBlacklist(pluginData, sharedMap);
            await this.syncEgressFilter(pluginData, sharedMap);

            this.state.updateConfigHash(configHash);
            this.state.setPluginConfigDetails(plugin.uuid, plugin.name);

            this.logger.log('[PLUGIN] Plugins changed...');

            if (currentTorrentBlocker && !pluginData.torrentBlocker?.enabled) {
                if (!pluginData.torrentBlocker?.includeRuleTags) {
                    await this.commandBus.execute(
                        new RemoveOutboundCommand(XRAY_TORRENT_BLOCKER_OUTBOUND_TAG),
                    );
                } else {
                    await this.commandBus.execute(
                        new StopXrayCommand({
                            withOnlineCheck: true,
                            withPluginCleanup: false,
                        }),
                    );
                }
            } else if (!currentTorrentBlocker && pluginData.torrentBlocker?.enabled) {
                await this.commandBus.execute(
                    new StopXrayCommand({
                        withOnlineCheck: true,
                        withPluginCleanup: false,
                    }),
                );
            }

            if (currentTorrentBlocker && pluginData.torrentBlocker?.enabled) {
                const oldTagsHash = this.hashFn([...currentTorrentBlockerIncludeRuleTags].sort());
                const newTagsHash = this.hashFn(
                    [...(pluginData.torrentBlocker.includeRuleTags ?? [])].sort(),
                );

                this.logger.log(
                    `[PLUGIN] Torrent-Blocker: oldTagsHash=${oldTagsHash}, newTagsHash=${newTagsHash}`,
                );

                if (oldTagsHash !== newTagsHash) {
                    await this.commandBus.execute(
                        new StopXrayCommand({
                            withOnlineCheck: true,
                            withPluginCleanup: false,
                        }),
                    );
                }
            }

            return { isOk: true, response: new GenericResponseModel(true) };
        } catch (error) {
            this.logger.error(error);
            return { isOk: true, response: new GenericResponseModel(false) };
        }
    }
    public async resetPlugins(): Promise<void> {
        this.state.resetState();
        this.state.cleanUpActivePlugin();
        await this.nftService.recreateTables();
    }

    private syncConnectionDrop(pluginData: TNodePlugin, sharedMap: Map<string, string[]>): void {
        if (!pluginData.connectionDrop) return;
        if (!pluginData.connectionDrop.enabled) return;
        if (!this.state.plugins.connectionDrop) return;

        const ips = this.resolveIpList(pluginData.connectionDrop.whitelistIps, sharedMap);
        this.state.connectionDrop.setWhitelistIps(ips);

        this.logger.log(`[PLUGIN] Connection-Drop: ${ips.length} whitelisted IPs synced.`);
    }

    private async syncBlacklist(
        pluginData: TNodePlugin,
        sharedMap: Map<string, string[]>,
    ): Promise<void> {
        if (!pluginData.blacklist) return;
        if (!pluginData.blacklist.enabled) return;
        if (!this.nftService.isAvailable) return;

        const ips = this.resolveIpList(pluginData.blacklist.ip, sharedMap);

        await this.nftService.syncBlacklist(ips);

        this.logger.log(`[PLUGIN] Blacklist: ${ips.length} IPs synced.`);
    }

    private async syncEgressFilter(
        pluginData: TNodePlugin,
        sharedMap: Map<string, string[]>,
    ): Promise<void> {
        if (!pluginData.egressFilter) return;
        if (!pluginData.egressFilter.enabled) return;
        if (!this.nftService.isAvailable) return;

        const ips = this.resolveIpList(pluginData.egressFilter.blockedIps ?? [], sharedMap);
        const ports = pluginData.egressFilter.blockedPorts ?? [];

        await this.nftService.syncEgressFilter({ ips, ports });

        this.logger.log(`[PLUGIN] Egress Filter: ${ips.length} IPs, ${ports.length} ports synced.`);
    }

    private syncTorrentBlocker(pluginData: TNodePlugin, sharedMap: Map<string, string[]>): void {
        if (!pluginData.torrentBlocker) return;
        if (!pluginData.torrentBlocker.enabled) return;
        if (!this.nftService.isAvailable) return;

        const { blockDuration, ignoreLists } = pluginData.torrentBlocker;

        const ips = this.resolveIpList(ignoreLists.ip ?? [], sharedMap);
        const users = ignoreLists.userId?.map(String) ?? [];

        this.state.torrentBlocker.setIgnoredIps(ips);
        this.state.torrentBlocker.setIgnoredUsers(users);
        this.state.torrentBlocker.configure(blockDuration);
        this.state.torrentBlocker.setIncludeRuleTags(pluginData.torrentBlocker.includeRuleTags);

        this.logger.log(
            `[PLUGIN] Torrent-Blocker: blockDuration=${blockDuration}s, ${ips.length} ignored IPs, ${users.length} ignored users`,
        );
    }

    private resolveIpList(ips: string[], sharedMap: Map<string, string[]>): string[] {
        return ips.flatMap((ip) => {
            if (ip.startsWith('ext:')) {
                const resolved = sharedMap.get(ip);
                if (!resolved) {
                    this.logger.warn(`[PLUGIN] Shared IP list "${ip}" not found`);
                    return [];
                }
                return resolved;
            }
            return ip;
        });
    }

    public async collectReports(): Promise<ICommandResponse<TorrentBlockerReportsResponseModel>> {
        try {
            if (!this.state.torrentBlocker.reportsCount) {
                return { isOk: true, response: new TorrentBlockerReportsResponseModel([]) };
            }

            const reports = this.state.torrentBlocker.flushReports();
            return { isOk: true, response: new TorrentBlockerReportsResponseModel(reports) };
        } catch (error) {
            this.logger.error(error);
            return { isOk: true, response: new TorrentBlockerReportsResponseModel([]) };
        }
    }
}
