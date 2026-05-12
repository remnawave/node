import { GetNodeHealthCheckVeilCommand } from '@libs/contracts/commands';

export class GetNodeHealthCheckVeilResponseModel
    implements GetNodeHealthCheckVeilCommand.Response['response']
{
    public isNodeOnline: boolean;
    public isVeilOnline: boolean;
    public veilVersion: null | string;
    public nodeVersion: string;

    constructor(
        isNodeOnline: boolean,
        isVeilOnline: boolean,
        veilVersion: null | string,
        nodeVersion: string,
    ) {
        this.isNodeOnline = isNodeOnline;
        this.isVeilOnline = isVeilOnline;
        this.veilVersion = veilVersion;
        this.nodeVersion = nodeVersion;
    }
}
