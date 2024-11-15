export class GetSystemStatsResponseModel {
    public numGoroutine: number;
    public numGC: number;
    public alloc: number;
    public totalAlloc: number;
    public sys: number;
    public mallocs: number;
    public frees: number;
    public liveObjects: number;
    public pauseTotalNs: number;
    public uptime: number;

    constructor(data: GetSystemStatsResponseModel) {
        this.numGoroutine = data.numGoroutine;
        this.numGC = data.numGC;
        this.alloc = data.alloc;
        this.totalAlloc = data.totalAlloc;
        this.sys = data.sys;
        this.mallocs = data.mallocs;
        this.frees = data.frees;
        this.liveObjects = data.liveObjects;
        this.pauseTotalNs = data.pauseTotalNs;
        this.uptime = data.uptime;
    }
}
