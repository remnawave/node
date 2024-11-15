import { z } from 'zod';

export namespace StopXrayCommand {
    export const ResponseSchema = z.object({
        response: z.object({
            isStopped: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
