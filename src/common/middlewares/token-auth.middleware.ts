import { NextFunction, Request, Response } from 'express';

import { Injectable, NestMiddleware } from '@nestjs/common';

import { TypedConfigService } from '@common/config/app-config';

@Injectable()
export class TokenAuthMiddleware implements NestMiddleware {
    private readonly token: string;

    constructor(private readonly configService: TypedConfigService) {
        this.token = this.configService.getOrThrow('INTERNAL_REST_TOKEN');
    }

    use(req: Request, res: Response, next: NextFunction): void {
        const token = req.query.token as string | undefined;

        if (!token || !this.token || token !== this.token) {
            res.socket?.destroy();
            return;
        }

        next();
    }
}
