import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PortGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const port =
            this.reflector.get<number>('port', context.getHandler()) ||
            this.reflector.get<number>('port', context.getClass());
        if (!port) return true;

        const req = context.switchToHttp().getRequest();
        const addressInfo = req.socket.server.address();

        const isInternal = addressInfo?.port === port;
        const isInternalIp = addressInfo?.address === '127.0.0.1';

        if (!isInternal || !isInternalIp) {
            const response = context.switchToHttp().getResponse();
            response.socket?.destroy();
            throw new UnauthorizedException('Unauthorized');
        }
        return isInternal;
    }
}
