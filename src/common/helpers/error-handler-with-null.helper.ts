import { ICommandResponse } from '../types/command-response.type';
import { errorHandler } from '@common/helpers/error-handler.helper';

export function errorHandlerWithNull<T>(response: ICommandResponse<T>): T | null {
    if (response.isOk) {
        if (!response.response) {
            return null;
        }
        return errorHandler(response);
    } else {
        return errorHandler(response);
    }
}
