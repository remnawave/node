import { z } from 'zod';

import { REST_API } from '../../api';

export enum CipherType {
    AES_128_GCM = 5,
    AES_256_GCM = 6,
    CHACHA20_POLY1305 = 7,
    NONE = 9,
    UNKNOWN = 0,
    UNRECOGNIZED = -1,
    XCHACHA20_POLY1305 = 8,
}

export namespace AddUserCommand {
    export const url = REST_API.HANDLER.ADD_USER;

    const BaseTrojanUser = z.object({
        type: z.literal('trojan'),
        tag: z.string(),
        username: z.string(),
        password: z.string(),
    });

    const BaseVlessUser = z.object({
        type: z.literal('vless'),
        tag: z.string(),
        username: z.string(),
        uuid: z.string(),
        flow: z.enum(['xtls-rprx-vision', '']),
    });

    const BaseShadowsocksUser = z.object({
        type: z.literal('shadowsocks'),
        tag: z.string(),
        username: z.string(),
        password: z.string(),
        cipherType: z.nativeEnum(CipherType),
        ivCheck: z.boolean(),
    });

    const BaseShadowsocks22User = z.object({
        type: z.literal('shadowsocks22'),
        tag: z.string(),
        username: z.string(),
        password: z.string(),
    });

    const BaseHysteriaUser = z.object({
        type: z.literal('hysteria'),
        tag: z.string(),
        username: z.string(),
        password: z.string(),
    });

    export const RequestSchema = z.object({
        data: z.array(
            z.discriminatedUnion('type', [
                BaseTrojanUser,
                BaseVlessUser,
                BaseShadowsocksUser,
                BaseShadowsocks22User,
                BaseHysteriaUser,
            ]),
        ),
        hashData: z.object({
            vlessUuid: z.string().uuid(),
            prevVlessUuid: z.optional(z.string().uuid()),
        }),
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
