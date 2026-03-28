import { z } from 'zod';

import { REST_API } from '../../api';

export namespace SyncCommand {
    export const url = REST_API.PLUGIN.SYNC;
    export const RequestSchema = z.object({
        plugin: z
            .object({
                config: z.record(z.unknown()),
                uuid: z.string().uuid(),
                name: z.string(),
            })
            .nullable(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            accepted: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
