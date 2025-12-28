import { z } from 'zod';

import { REST_API } from '../../api';

export namespace RemoveUsersCommand {
    export const url = REST_API.HANDLER.REMOVE_USERS;

    export const RequestSchema = z.object({
        users: z.array(
            z.object({
                userId: z.string(),
                hashUuid: z.string().uuid(),
            }),
        ),
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
