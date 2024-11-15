import { z } from 'zod';

export namespace GetOutboundStatsCommand {
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
