import { z } from 'zod';

import { REST_API } from '../../api';

export namespace GetNodeHealthCheckVeilCommand {
    export const url = REST_API.VEIL.NODE_HEALTH_CHECK;

    export const RequestSchema = z.object({}).strict();
    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            /** Node-process self-reports as alive. */
            isNodeOnline: z.boolean(),
            /** veil daemon is running and its admin API responds. */
            isVeilOnline: z.boolean(),
            /** Reported by `veil --version`; null when the binary is missing. */
            veilVersion: z.string().nullable(),
            /** This Remnawave Node package's version. */
            nodeVersion: z.string(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
