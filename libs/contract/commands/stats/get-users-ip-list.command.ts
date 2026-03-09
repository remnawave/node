import { z } from 'zod';

import { REST_API } from '../../api';
export namespace GetUsersIpListCommand {
    export const url = REST_API.STATS.GET_USERS_IP_LIST;

    export const ResponseSchema = z.object({
        response: z.object({
            users: z.array(
                z.object({
                    userId: z.string(),
                    ips: z.array(
                        z.object({
                            ip: z.string(),
                            lastSeen: z
                                .string()
                                .datetime({
                                    local: true,
                                    offset: true,
                                })
                                .transform((str) => new Date(str)),
                        }),
                    ),
                }),
            ),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
