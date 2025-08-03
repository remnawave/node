export interface IHashPayload {
    emptyConfig: string;
    inbounds: {
        usersCount: number;
        hash: string;
        tag: string;
    }[];
}
