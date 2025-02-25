import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class JwtDefaultGuard extends AuthGuard('registeredUserJWT') {
    constructor(private readonly logger: Logger) {
        super();
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (info instanceof Error || err || !user) {
            const response = context.switchToHttp().getResponse();

            this.logger.error(`Incorrent SSL_CERT or JWT: ${err}`);

            response.socket?.destroy();
            throw new UnauthorizedException('Unauthorized');
        }
        return user;
    }
}
