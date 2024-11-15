import { IInboundUser } from './interfaces';

export class GetInboundUsersResponseModel {
    public users: IInboundUser[];

    constructor(users: IInboundUser[]) {
        this.users = users.map((user) => ({
            username: user.username,
            level: user.level,
            protocol: user.protocol,
        }));
    }
}
