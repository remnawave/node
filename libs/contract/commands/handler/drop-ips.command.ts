import { z } from 'zod';

import { REST_API } from '../../api';

export namespace DropIpsCommand {
    export const url = REST_API.HANDLER.DROP_IPS;

    export const RequestSchema = z.object({
        ips: z.array(z.string()).min(1),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            success: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
