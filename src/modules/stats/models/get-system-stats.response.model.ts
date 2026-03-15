interface IXrayStats {
    numGoroutine: number;
    numGC: number;
    alloc: number;
    totalAlloc: number;
    sys: number;
    mallocs: number;
    frees: number;
    liveObjects: number;
    pauseTotalNs: number;
    uptime: number;
}

interface IPluginStats {
    torrentBlocker: {
        reportsCount: number;
    };
}

interface IHotHostInfo {
    memoryFree: number;
    uptime: number;
}

export class GetSystemStatsResponseModel {
    public xrayInfo: IXrayStats | null;
    public plugins: IPluginStats;
    public hotHostInfo: IHotHostInfo;

    constructor(xrayInfo: IXrayStats | null, plugins: IPluginStats, hotHostInfo: IHotHostInfo) {
        this.xrayInfo = xrayInfo;
        this.plugins = plugins;
        this.hotHostInfo = hotHostInfo;
    }
}
