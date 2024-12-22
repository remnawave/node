export interface ICommandResponse<T> {
    code?: string;
    isOk: boolean;
    message?: string;
    response?: T;
}
