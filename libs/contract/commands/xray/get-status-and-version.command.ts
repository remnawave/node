import { z } from 'zod';

export namespace GetStatusAndVersionCommand {
    export const ResponseSchema = z.object({
        response: z.object({
            isRunning: z.boolean(),
            version: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
