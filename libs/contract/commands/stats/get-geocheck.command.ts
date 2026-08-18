import { z } from 'zod';

import { REST_API } from '../../api';
export namespace GetGeocheckCommand {
    export const url = REST_API.STATS.GET_GEOCHECK;

    export const RequestSchema = z.object({
        ip: z.string().optional(),
        interface: z.string().optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.looseObject({
            image: z.object({
                format: z.literal('svg'),
                media_type: z.literal('image/svg+xml'),
                encoding: z.literal('base64'),
                data: z.string(),
            }),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
