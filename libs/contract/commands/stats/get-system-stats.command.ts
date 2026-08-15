import { z } from 'zod';

import { REST_API } from '../../api';
import { NodeSystemStatsSchema } from '../../models';
export namespace GetSystemStatsCommand {
    export const url = REST_API.STATS.GET_SYSTEM_STATS;

    export const ResponseSchema = z.object({
        response: z.object({
            xrayInfo: z
                .object({
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
                })
                .nullable(),
            plugins: z.object({
                abuseBlocker: z.object({
                    available: z.boolean(),
                    enabled: z.boolean(),
                    reportsCount: z.number(),
                    trackedUsers: z.number(),
                    activeIncidents: z.number(),
                    coverageMode: z.enum(['full', 'partial']),
                    skippedWebhookRules: z.number(),
                    evictedUsers: z.number(),
                    evictedKeys: z.number(),
                    droppedReports: z.number(),
                    lastError: z.string().nullable(),
                }),
                torrentBlocker: z.object({
                    reportsCount: z.number(),
                }),
            }),
            system: z.object({
                stats: NodeSystemStatsSchema,
            }),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
