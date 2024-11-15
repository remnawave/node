export class GetInboundStatsResponseModel {
    public inbound: string;
    public downlink: number;
    public uplink: number;

    constructor(data: GetInboundStatsResponseModel) {
        this.inbound = data.inbound;
        this.downlink = data.downlink;
        this.uplink = data.uplink;
    }
}
