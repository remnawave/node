import z from 'zod';

import { XrayWebhookSchema } from './xray-webhook.schema';

export const TorrentBlockerReportSchema = z.object({
    actionReport: z.object({
        blocked: z.boolean(),
        ip: z.string(),
        blockDuration: z.number(),
        willUnblockAt: z
            .string()
            .datetime({ offset: true, local: true })
            .transform((str) => new Date(str)),
        userId: z.string(),
        processedAt: z
            .string()
            .datetime({ offset: true, local: true })
            .transform((str) => new Date(str)),
    }),
    xrayReport: XrayWebhookSchema,
});

export type TorrentBlockerReportModel = z.infer<typeof TorrentBlockerReportSchema>;
