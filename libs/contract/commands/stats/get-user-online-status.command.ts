import { z } from 'zod';

export namespace GetUserOnlineStatusCommand {
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
