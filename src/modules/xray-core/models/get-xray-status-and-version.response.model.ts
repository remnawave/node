export class GetXrayStatusAndVersionResponseModel {
    public isRunning: boolean;
    public version: string | null;

    constructor(isRunning: boolean, version: string | null) {
        this.isRunning = isRunning;
        this.version = version;
    }
}
