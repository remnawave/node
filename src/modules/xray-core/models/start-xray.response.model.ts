export class StartXrayResponseModel {
    public isStarted: boolean;
    public version: string | null;
    public error: string | null;

    constructor(isStarted: boolean, version: string | null, error: string | null) {
        this.isStarted = isStarted;
        this.version = version;
        this.error = error;
    }
}
