import { IInboundStat, IOutboundStat } from './interfaces';

export class GetCombinedStatsResponseModel {
    public inbounds: IInboundStat[];
    public outbounds: IOutboundStat[];

    constructor(inbounds: IInboundStat[], outbounds: IOutboundStat[]) {
        this.inbounds = inbounds;
        this.outbounds = outbounds;
    }
}
