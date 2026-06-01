import { z } from 'zod';

import { REST_API } from '../../api';

export namespace StopVeilCommand {
    export const url = REST_API.VEIL.STOP;

    export const RequestSchema = z.object({}).strict();
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isStopped: z.boolean(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
