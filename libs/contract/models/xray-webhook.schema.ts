import { z } from 'zod';

export const XrayWebhookSchema = z.object({
    email: z.string().nullable(),
    level: z.number().nullable(),
    protocol: z.string().nullable(),
    network: z.string(),
    source: z.string().nullable(),
    destination: z.string(),
    routeTarget: z.string().nullable(),
    originalTarget: z.string().nullable(),
    inboundTag: z.string().nullable(),
    inboundName: z.string().nullable(),
    inboundLocal: z.string().nullable(),
    outboundTag: z.string().nullable(),
    ts: z.number(),
});

export type XrayWebhookModel = z.infer<typeof XrayWebhookSchema>;
