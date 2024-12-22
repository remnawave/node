import { z } from 'zod';

import { REST_API } from '../../api';
export namespace GetSystemStatsCommand {
    export const url = REST_API.STATS.GET_SYSTEM_STATS;

    export const ResponseSchema = z.object({
        response: z.object({
            numGoroutine: z.number(),
            numGC: z.number(),
            alloc: z.number(),
            totalAlloc: z.number(),
            sys: z.number(),
            mallocs: z.number(),
            frees: z.number(),
            liveObjects: z.number(),
            pauseTotalNs: z.number(),
            uptime: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
