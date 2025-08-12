import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IHashPayload, X_HASH_PAYLOAD } from '@libs/contracts/constants';

export const HashPayload = createParamDecorator((_, ctx: ExecutionContext): IHashPayload | null => {
    const request = ctx.switchToHttp().getRequest();

    const hashPayload = request.headers[X_HASH_PAYLOAD.toLowerCase()];

    if (hashPayload) {
        try {
            const decodedPayload = Buffer.from(hashPayload as string, 'base64').toString('utf-8');
            const hashPayloadJson = JSON.parse(decodedPayload);

            return hashPayloadJson as IHashPayload;
        } catch {
            return null;
        }
    }

    return null;
});
