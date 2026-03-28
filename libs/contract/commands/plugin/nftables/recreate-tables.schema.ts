import { z } from 'zod';

import { REST_API } from '../../../api';

export namespace RecreateTablesCommand {
    export const url = REST_API.PLUGIN.NFTABLES.RECREATE_TABLES;

    export const ResponseSchema = z.object({ response: z.object({ accepted: z.boolean() }) });
    export type Response = z.infer<typeof ResponseSchema>;
}
