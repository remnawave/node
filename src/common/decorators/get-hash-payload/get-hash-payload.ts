import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IHashPayload, X_HASH_PAYLOAD } from '@libs/contracts/constants';

export const HashPayload = createParamDecorator((_, ctx: ExecutionContext): IHashPayload | null => {
    const request = ctx.switchToHttp().getRequest();

    if (request.headers[X_HASH_PAYLOAD.toLowerCase()]) {
        try {
            const hashPayload = request.headers[X_HASH_PAYLOAD.toLowerCase()] as string;
            const decodedPayload = Buffer.from(hashPayload, 'base64').toString('utf-8');
            const hashPayloadJson = JSON.parse(decodedPayload);

            return hashPayloadJson as IHashPayload;
        } catch {
            return null;
        }
    }

    return null;
});
