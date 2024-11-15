import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class JwtDefaultGuard extends AuthGuard('registeredUserJWT') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (info instanceof Error || err || !user) {
            const response = context.switchToHttp().getResponse();
            response.socket?.destroy();
            throw new UnauthorizedException('Unauthorized');
        }
        return user;
    }
}
