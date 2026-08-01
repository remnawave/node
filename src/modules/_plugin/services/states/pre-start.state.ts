import { IPreStartCleanupSockets, IPreStartConfig } from '../../interfaces';

export class PreStartState {
    private enabled = false;
    private cleanupSockets: IPreStartCleanupSockets = { enabled: false, files: [] };

    get isEnabled(): boolean {
        return this.enabled;
    }

    get cleanupSocketsConfig(): IPreStartCleanupSockets {
        return this.cleanupSockets;
    }

    configure(config: IPreStartConfig): void {
        this.enabled = true;
        this.cleanupSockets = {
            enabled: config.cleanupSockets.enabled,
            files: [...config.cleanupSockets.files],
        };
    }

    reset(): void {
        this.enabled = false;
        this.cleanupSockets = { enabled: false, files: [] };
    }
}
