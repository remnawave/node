import { IUserStat } from './interfaces';

export class GetUsersStatsResponseModel {
    public users: IUserStat[];

    constructor(users: IUserStat[]) {
        this.users = users;
    }
}
