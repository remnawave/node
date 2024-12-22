export class GetXrayStatusAndVersionResponseModel {
    public isRunning: boolean;
    public version: null | string;

    constructor(isRunning: boolean, version: null | string) {
        this.isRunning = isRunning;
        this.version = version;
    }
}
