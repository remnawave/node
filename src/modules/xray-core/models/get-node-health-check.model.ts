export class GetNodeHealthCheckResponseModel {
    public isAlive: boolean;
    public xrayInternalStatusCached: boolean;
    public xrayVersion: null | string;
    constructor(isAlive: boolean, xrayInternalStatusCached: boolean, xrayVersion: null | string) {
        this.isAlive = isAlive;
        this.xrayInternalStatusCached = xrayInternalStatusCached;
        this.xrayVersion = xrayVersion;
    }
}
