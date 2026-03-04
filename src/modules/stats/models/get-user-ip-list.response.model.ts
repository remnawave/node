interface IDetailedIp {
    ip: string;
    lastSeen: Date;
}

export class GetUserIpListResponseModel {
    public ips: IDetailedIp[];

    constructor(ips: IDetailedIp[]) {
        this.ips = ips;
    }
}
