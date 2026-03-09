interface IUsersIpListInput {
    email: string;
    ips: {
        ip: string;
        lastSeen: number;
    }[];
}

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

    constructor(users: IUsersIpListInput[]) {
        this.users = users.map((user) => ({
            userId: user.email,
            ips: user.ips.map((ip) => ({
                ip: ip.ip,
                lastSeen: new Date(ip.lastSeen * 1000),
            })),
        }));
    }
}
