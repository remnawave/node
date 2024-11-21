import { IOutboundStat } from './interfaces';

export class GetAllOutboundsStatsResponseModel {
    public outbounds: IOutboundStat[];

    constructor(outbounds: IOutboundStat[]) {
        this.outbounds = outbounds;
    }
}
