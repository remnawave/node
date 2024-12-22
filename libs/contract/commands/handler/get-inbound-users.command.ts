import { z } from 'zod';

import { REST_API } from '../../api';

export namespace GetInboundUsersCommand {
    export const url = REST_API.HANDLER.GET_INBOUND_USERS;
    export const RequestSchema = z.object({
        tag: z.string(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            users: z.array(
                z.object({
                    username: z.string(),
                    email: z.string().optional(),
                    level: z.number().optional(),
                }),
            ),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
