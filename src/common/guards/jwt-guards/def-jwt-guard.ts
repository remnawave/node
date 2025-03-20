import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class JwtDefaultGuard extends AuthGuard('registeredUserJWT') {
    private readonly logger = new Logger(JwtDefaultGuard.name);

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (info instanceof Error || err || !user) {
            const response = context.switchToHttp().getResponse();

            // TODO: remove later
            this.logger.log(`${JSON.stringify(context.switchToHttp().getRequest().headers)}`);

            this.logger.error(
                `Incorrect SSL_CERT or JWT! Request dropped. URL: ${context.switchToHttp().getRequest().url}, IP: ${context.switchToHttp().getRequest().ip}`,
            );

            response.socket?.destroy();
            throw new UnauthorizedException('Unauthorized');
        }
        return user;
    }
}
