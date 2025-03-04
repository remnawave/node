import { z } from 'zod';

import { REST_API } from '../../api';

export namespace GetNodeHealthCheckCommand {
    export const url = REST_API.XRAY.NODE_HEALTH_CHECK;

    export const ResponseSchema = z.object({
        response: z.object({
            isAlive: z.boolean(),
            xrayInternalStatusCached: z.boolean(),
            xrayVersion: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
