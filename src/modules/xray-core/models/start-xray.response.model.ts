import { TNodeSystem } from '@libs/contracts/models';

interface INodeInformation {
    version: string | null;
}

export class StartXrayResponseModel {
    public isStarted: boolean;
    public version: null | string;
    public error: null | string;
    public nodeInformation: INodeInformation;
    public system: TNodeSystem;

    constructor(
        isStarted: boolean,
        version: null | string,
        error: null | string,
        nodeInformation: INodeInformation,
        system: TNodeSystem,
    ) {
        this.isStarted = isStarted;
        this.version = version;
        this.error = error;
        this.nodeInformation = nodeInformation;
        this.system = system;
    }
}
