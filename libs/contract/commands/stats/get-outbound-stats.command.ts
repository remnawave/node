import { z } from 'zod';
import { REST_API } from '../../api';
export namespace GetOutboundStatsCommand {
    export const url = REST_API.STATS.GET_OUTBOUND_STATS;

    export const RequestSchema = z.object({
        tag: z.string(),
        reset: z.boolean(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            outbound: z.string(),
            downlink: z.number(),
            uplink: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
