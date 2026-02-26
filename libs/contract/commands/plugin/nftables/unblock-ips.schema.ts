import { z } from 'zod';

import { REST_API } from '../../../api';

export namespace UnblockIpsCommand {
    export const url = REST_API.PLUGIN.NFTABLES.UNBLOCK_IPS;

    export const RequestSchema = z.object({
        ips: z.array(z.string().ip()),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            accepted: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
