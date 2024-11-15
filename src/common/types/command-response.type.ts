export interface ICommandResponse<T> {
    isOk: boolean;
    response?: T;
    code?: string;
    message?: string;
}
