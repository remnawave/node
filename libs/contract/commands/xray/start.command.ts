import { z } from 'zod';

import { REST_API } from '../../api';
export namespace StartXrayCommand {
    export const url = REST_API.XRAY.START;
    export const RequestSchema = z.record(z.unknown());

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isStarted: z.boolean(),
            version: z.string().nullable(),
            error: z.string().nullable(),
            systemInformation: z.nullable(
                z.object({
                    cpuCores: z.number(),
                    cpuModel: z.string(),
                    memoryTotal: z.string(),
                }),
            ),
            nodeInformation: z.object({
                version: z.string().nullable(),
            }),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
