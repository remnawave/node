import { z } from 'zod';

import { REST_API } from '../../api';

export namespace GetInboundUsersCountCommand {
    export const url = REST_API.HANDLER.GET_INBOUND_USERS_COUNT;

    export const RequestSchema = z.object({
        tag: z.string(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            count: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
