import { z } from 'zod';

export namespace RemoveUserCommand {
    export const RequestSchema = z.object({
        tag: z.string(),
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
