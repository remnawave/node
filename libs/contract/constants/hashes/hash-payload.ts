export interface IHashPayload {
    emptyConfig: string;
    inbounds: {
        usersCount: number;
        hash: number;
        tag: string;
    }[];
}
