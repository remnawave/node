interface IDetailedIp {
    ip: string;
    lastSeen: Date;
}

interface IUserIpList {
    userId: string;
    ips: IDetailedIp[];
}

export class GetUsersIpListResponseModel {
    public users: IUserIpList[];

    constructor(users: IUserIpList[]) {
        this.users = users;
    }
}
