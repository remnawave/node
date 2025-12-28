import { z } from 'zod';

import { REST_API } from '../../api';

export namespace AddUsersCommand {
    export const url = REST_API.HANDLER.ADD_USERS;

    const BaseTrojanUser = z.object({
        type: z.literal('trojan'),
        tag: z.string(),
    });

    const BaseVlessUser = z.object({
        type: z.literal('vless'),
        tag: z.string(),
        flow: z.enum(['xtls-rprx-vision', '']),
    });

    const BaseShadowsocksUser = z.object({
        type: z.literal('shadowsocks'),
        tag: z.string(),
    });

    export const RequestSchema = z.object({
        affectedInboundTags: z.array(z.string()),
        users: z.array(
            z.object({
                inboundData: z.array(
                    z.discriminatedUnion('type', [
                        BaseTrojanUser,
                        BaseVlessUser,
                        BaseShadowsocksUser,
                    ]),
                ),

                userData: z.object({
                    userId: z.string(),
                    hashUuid: z.string().uuid(),
                    vlessUuid: z.string().uuid(),
                    trojanPassword: z.string(),
                    ssPassword: z.string(),
                }),
            }),
        ),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            success: z.boolean(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
