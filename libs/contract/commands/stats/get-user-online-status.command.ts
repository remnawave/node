import { z } from 'zod';
import { REST_API } from '../../api';
export namespace GetUserOnlineStatusCommand {
    export const url = REST_API.STATS.GET_USER_ONLINE_STATUS;
    export const RequestSchema = z.object({
        username: z.string(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isOnline: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
