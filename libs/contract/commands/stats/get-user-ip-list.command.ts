import { z } from 'zod';

import { REST_API } from '../../api';
export namespace GetUserIpListCommand {
    export const url = REST_API.STATS.GET_USER_IP_LIST;

    export const RequestSchema = z.object({
        userId: z.string(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            ips: z.array(
                z.object({
                    ip: z.string(),
                    lastSeen: z
                        .string()
                        .datetime({ local: true, offset: true, message: 'Invalid date format' })
                        .transform((str) => new Date(str)),
                }),
            ),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
