import { z } from 'zod';
import { REST_API } from '../../api';

export namespace GetStatusAndVersionCommand {
    export const url = REST_API.XRAY.STATUS;

    export const ResponseSchema = z.object({
        response: z.object({
            isRunning: z.boolean(),
            version: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
