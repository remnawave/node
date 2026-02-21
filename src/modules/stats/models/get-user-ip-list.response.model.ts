export class GetUserIpListResponseModel {
    public ips: string[];

    constructor(ips: string[]) {
        this.ips = ips;
    }
}
