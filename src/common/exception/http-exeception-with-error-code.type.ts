import { HttpException } from '@nestjs/common/exceptions/http.exception';

export class HttpExceptionWithErrorCodeType extends HttpException {
    errorCode: string;

    constructor(message: string, errorCode: string, statusCode: number) {
        super(message, statusCode);
        this.errorCode = errorCode;
    }
}
