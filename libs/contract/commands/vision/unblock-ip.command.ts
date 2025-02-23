import { z } from 'zod';

import { REST_API } from '../../api';

export namespace UnblockIpCommand {
    export const url = REST_API.VISION.UNBLOCK_IP;

    export const RequestSchema = z.object({
        ip: z.string(),
        username: z.string(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            success: z.boolean(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
