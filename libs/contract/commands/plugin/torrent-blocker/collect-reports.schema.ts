import { z } from 'zod';

import { TorrentBlockerReportSchema } from '../../../models';
import { REST_API } from '../../../api';

export namespace CollectReportsCommand {
    export const url = REST_API.PLUGIN.TORRENT_BLOCKER.COLLECT;

    export const ResponseSchema = z.object({
        response: z.object({
            reports: z.array(TorrentBlockerReportSchema),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
