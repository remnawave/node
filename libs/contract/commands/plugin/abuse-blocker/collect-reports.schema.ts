import { z } from 'zod';

import { REST_API } from '../../../api';
import { AbuseBlockerReportSchema } from '../../../models';

export namespace CollectAbuseBlockerReportsCommand {
    export const url = REST_API.PLUGIN.ABUSE_BLOCKER.COLLECT;

    export const ResponseSchema = z.object({
        response: z.object({
            reports: z.array(AbuseBlockerReportSchema),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
