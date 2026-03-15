interface IHostInfo {
    arch: string;
    cpus: number;
    cpuModel: string;
    memoryTotal: number;
    hostname: string;
    platform: string;
    release: string;
    type: string;
    version: string;
    networkInterfaces: string[];
}

interface IHotHostInfo {
    memoryFree: number;
    uptime: number;
}

interface INodeInformation {
    version: string | null;
    hostInfo: IHostInfo;
    hotHostInfo: IHotHostInfo;
}

export class StartXrayResponseModel {
    public isStarted: boolean;
    public version: null | string;
    public error: null | string;
    public nodeInformation: INodeInformation;

    constructor(
        isStarted: boolean,
        version: null | string,
        error: null | string,
        nodeInformation: INodeInformation,
    ) {
        this.isStarted = isStarted;
        this.version = version;
        this.error = error;
        this.nodeInformation = nodeInformation;
    }
}
