import { errorHandler } from '@common/helpers/error-handler.helper';

import { ICommandResponse } from '../types/command-response.type';

export function errorHandlerWithNull<T>(response: ICommandResponse<T>): null | T {
    if (response.isOk) {
        if (!response.response) {
            return null;
        }
        return errorHandler(response);
    } else {
        return errorHandler(response);
    }
}
