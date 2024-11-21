import { z } from 'zod';
import { REST_API } from '../../api';
export namespace GetAllOutboundsStatsCommand {
    export const url = REST_API.STATS.GET_ALL_OUTBOUNDS_STATS;

    export const RequestSchema = z.object({
        reset: z.boolean(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            outbounds: z.array(
                z.object({
                    outbound: z.string(),
                    downlink: z.number(),
                    uplink: z.number(),
                }),
            ),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
