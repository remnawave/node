import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { X_FORCE_RESTART } from '@libs/contracts/constants';

export const XForceRestart = createParamDecorator((_, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest();

    const forceRestart: string | undefined = request.headers[X_FORCE_RESTART.toLowerCase()];

    if (forceRestart) {
        if (forceRestart === 'true' || forceRestart === '1') {
            return true;
        }
    }

    return false;
});
