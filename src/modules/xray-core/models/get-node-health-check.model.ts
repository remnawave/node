export class GetNodeHealthCheckResponseModel {
    public isAlive: boolean;
    public xrayInternalStatusCached: boolean;
    public xrayVersion: null | string;
    public nodeVersion: string;
    constructor(
        isAlive: boolean,
        xrayInternalStatusCached: boolean,
        xrayVersion: null | string,
        nodeVersion: string,
    ) {
        this.isAlive = isAlive;
        this.xrayInternalStatusCached = xrayInternalStatusCached;
        this.xrayVersion = xrayVersion;
        this.nodeVersion = nodeVersion;
    }
}
