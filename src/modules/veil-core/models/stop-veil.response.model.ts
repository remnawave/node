import { StopVeilCommand } from '@libs/contracts/commands';

export class StopVeilResponseModel implements StopVeilCommand.Response['response'] {
    public isStopped: boolean;

    constructor(isStopped: boolean) {
        this.isStopped = isStopped;
    }
}
