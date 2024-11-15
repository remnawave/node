export class GetOutboundStatsResponseModel {
    public outbound: string;
    public downlink: number;
    public uplink: number;

    constructor(data: GetOutboundStatsResponseModel) {
        this.outbound = data.outbound;
        this.downlink = data.downlink;
        this.uplink = data.uplink;
    }
}
