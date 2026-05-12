import { z } from 'zod';

import { NodeSystemSchema } from '../../models';
import { REST_API } from '../../api';

export namespace StartVeilCommand {
    export const url = REST_API.VEIL.START;

    /**
     * StartVeilCommand drives the local veil-server process via
     * supervisord. The panel pushes the full server.yaml as a string
     * (so future schema bumps don't require a node-side rebuild) plus
     * the bind address of the embedded admin API the panel will poll
     * for health.
     */
    export const RequestSchema = z.object({
        internals: z.object({
            forceRestart: z.boolean().default(false),
            /**
             * SHA-256 of the full server.yaml the panel intends to
             * push. The node uses it to short-circuit a restart when
             * the running config matches.
             */
            configHash: z.string(),
        }),
        /**
         * server.yaml verbatim. Validated by the veil binary at start
         * time; we do not re-parse it here because the YAML schema
         * lives in the veil core repo and would create a cross-
         * project version coupling.
         */
        serverConfig: z.string(),
        /**
         * Optional admin API address (host:port) to expose to the
         * panel. Defaults to 127.0.0.1:9090 when omitted.
         */
        adminAddr: z.string().optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isStarted: z.boolean(),
            version: z.string().nullable(),
            error: z.string().nullable(),
            nodeInformation: z.object({
                version: z.string().nullable(),
            }),
            system: NodeSystemSchema,
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
