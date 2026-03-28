import { TNodeSystemStats } from '@libs/contracts/models';

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

export class GetSystemStatsResponseModel {
    public xrayInfo: IXrayStats | null;
    public plugins: IPluginStats;
    public system: {
        stats: TNodeSystemStats;
    };

    constructor(xrayInfo: IXrayStats | null, plugins: IPluginStats, systemStats: TNodeSystemStats) {
        this.xrayInfo = xrayInfo;
        this.plugins = plugins;
        this.system = {
            stats: systemStats,
        };
    }
}
