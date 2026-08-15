import { z } from 'zod';

import { REST_API } from '../../../api';

export namespace RefreshAbuseBlockCommand {
    export const url = REST_API.PLUGIN.ABUSE_BLOCKER.REFRESH_BLOCK;

    export const RequestSchema = z.object({
        ip: z.union([z.ipv4(), z.ipv6()]),
        timeout: z.int().min(1).max(2592000),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            accepted: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
