import { ISystemStats } from '@common/utils/get-system-stats/get-system-stats.interface';

export class StartXrayResponseModel {
    public isStarted: boolean;
    public version: null | string;
    public error: null | string;
    public systemInformation: ISystemStats | null;
    public nodeInformation: {
        version: string | null;
    };

    constructor(
        isStarted: boolean,
        version: null | string,
        error: null | string,
        systemInformation: ISystemStats | null,
        nodeInformation: {
            version: string | null;
        },
    ) {
        this.isStarted = isStarted;
        this.version = version;
        this.error = error;
        this.systemInformation = systemInformation;
        this.nodeInformation = nodeInformation;
    }
}
