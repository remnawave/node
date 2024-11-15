import { z } from 'zod';

export namespace GetInboundUsersCommand {
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
