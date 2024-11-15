import { z } from 'zod';

export namespace StartXrayCommand {
    export const RequestSchema = z.record(z.unknown());

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isStarted: z.boolean(),
            version: z.string().nullable(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
