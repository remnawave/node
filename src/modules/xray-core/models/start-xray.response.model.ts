import { ISystemStats } from '../../../common/utils/get-system-stats/get-system-stats.interface';

export class StartXrayResponseModel {
    public isStarted: boolean;
    public version: string | null;
    public error: string | null;
    public systemInformation: ISystemStats | null;

    constructor(
        isStarted: boolean,
        version: string | null,
        error: string | null,
        systemInformation: ISystemStats | null,
    ) {
        this.isStarted = isStarted;
        this.version = version;
        this.error = error;
        this.systemInformation = systemInformation;
    }
}
