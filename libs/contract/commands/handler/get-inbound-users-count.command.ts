import { z } from 'zod';

export namespace GetInboundUsersCountCommand {
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
