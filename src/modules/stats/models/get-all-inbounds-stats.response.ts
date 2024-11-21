import { IInboundStat } from './interfaces';

export class GetAllInboundsStatsResponseModel {
    public inbounds: IInboundStat[];

    constructor(inbounds: IInboundStat[]) {
        this.inbounds = inbounds;
    }
}
