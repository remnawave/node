import { z } from 'zod';

import { REST_API } from '../../api';

export namespace RemoveUserCommand {
    export const url = REST_API.HANDLER.REMOVE_USER;

    export const RequestSchema = z.object({
        username: z.string(),
        hashData: z.object({
            vlessUuid: z.string().uuid(),
        }),
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
