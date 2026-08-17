import { Injectable } from '@nestjs/common';

import { IPlugins } from '../interfaces';
import {
    AbuseBlockerState,
    TorrentBlockerState,
    ConnectionDropState,
    PreStartState,
} from './states';

@Injectable()
export class PluginStateService {
    public readonly abuseBlocker = new AbuseBlockerState();
    public readonly torrentBlocker = new TorrentBlockerState();
    public readonly connectionDrop = new ConnectionDropState();
    public readonly preStart = new PreStartState();

    private initialized = false;
    private lastConfigHash: string | null = null;

    private availablePlugins: IPlugins = {
        abuseBlocker: false,
        connectionDrop: false,
        ingressFilter: false,
        torrentBlocker: false,
        egressFilter: false,
        preStart: true,
    };

    private pluginConfigDetails: { uuid: string; name: string } | null = null;

    get isInitialized(): boolean {
        return this.initialized;
    }

    get plugins(): IPlugins {
        return this.availablePlugins;
    }

    setPlugins(plugins: IPlugins): void {
        this.availablePlugins = plugins;
    }

    isConfigChanged(configHash: string): boolean {
        return this.lastConfigHash !== configHash;
    }

    updateConfigHash(hash: string): void {
        this.lastConfigHash = hash;
        this.initialized = true;
    }

    resetState(): void {
        this.abuseBlocker.reset();
        this.torrentBlocker.reset();
        this.connectionDrop.reset();
        this.preStart.reset();
    }

    cleanUpActivePlugin(): void {
        this.pluginConfigDetails = null;
        this.lastConfigHash = null;
        this.initialized = false;
    }

    setPluginConfigDetails(uuid: string, name: string): void {
        this.pluginConfigDetails = { uuid, name };
    }

    getPluginConfigDetails(): { uuid: string; name: string } | null {
        return this.pluginConfigDetails;
    }

    hasActivePlugin(): boolean {
        return this.pluginConfigDetails !== null;
    }
}
