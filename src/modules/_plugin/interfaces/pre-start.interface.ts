export interface IPreStartCleanupSockets {
    enabled: boolean;
    files: string[];
}

export interface IPreStartConfig {
    cleanupSockets: IPreStartCleanupSockets;
}
