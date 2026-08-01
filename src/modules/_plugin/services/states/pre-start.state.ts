import { TNodePlugin } from '@remnawave/node-plugins';

type TPreStartConfig = NonNullable<TNodePlugin['preStart']>;
type TPreStartCleanupSockets = NonNullable<TPreStartConfig['cleanupSockets']>;

export class PreStartState {
    private enabled = false;
    private cleanupSockets: TPreStartCleanupSockets = { enabled: false, files: [] };

    get isEnabled(): boolean {
        return this.enabled;
    }

    get cleanupSocketsConfig(): TPreStartCleanupSockets {
        return this.cleanupSockets;
    }

    configure(config: TPreStartConfig): void {
        this.enabled = config.enabled;

        this.cleanupSockets = config.cleanupSockets
            ? { enabled: config.cleanupSockets.enabled, files: [...config.cleanupSockets.files] }
            : { enabled: false, files: [] };
    }

    reset(): void {
        this.enabled = false;
        this.cleanupSockets = { enabled: false, files: [] };
    }
}
