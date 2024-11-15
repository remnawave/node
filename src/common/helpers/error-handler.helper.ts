import { InternalServerErrorException } from '@nestjs/common';
import { ICommandResponse } from '../types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';
import { HttpExceptionWithErrorCodeType } from '../exception/http-exeception-with-error-code.type';

export function errorHandler<T>(response: ICommandResponse<T>): T {
    if (response.isOk) {
        if (!response.response) {
            throw new InternalServerErrorException('No data returned');
        }
        return response.response;
    } else {
        if (!response.code) {
            throw new InternalServerErrorException('Unknown error');
        }
        const errorObject = Object.values(ERRORS).find((error) => error.code === response.code);

        if (!errorObject) {
            throw new InternalServerErrorException('Unknown error');
        }
        throw new HttpExceptionWithErrorCodeType(
            errorObject.message,
            errorObject.code,
            errorObject.httpCode,
        );
    }
}
