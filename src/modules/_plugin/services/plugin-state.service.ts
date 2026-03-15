import { Injectable } from '@nestjs/common';

import { TorrentBlockerState, ConnectionDropState } from './states';
import { IPlugins } from '../interfaces';

@Injectable()
export class PluginStateService {
    public readonly torrentBlocker = new TorrentBlockerState();
    public readonly connectionDrop = new ConnectionDropState();

    private initialized = false;
    private lastConfigHash: string | null = null;

    private availablePlugins: IPlugins = {
        connectionDrop: false,
        ingressFilter: false,
        torrentBlocker: false,
        egressFilter: false,
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
        this.torrentBlocker.reset();
        this.connectionDrop.reset();
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
