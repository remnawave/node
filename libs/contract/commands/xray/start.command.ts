import { z } from 'zod';

import { REST_API } from '../../api';

const UNSUPPORTED_REMNAWAVE_VERSION_MESSAGE = {
    message:
        'Unsupported Remnawave version. Please, upgrade Remnawave to version v2.3.x or higher. Or downgrade Remnawave Node version to v2.2.3 (change :latest to :2.2.3 in docker-compose.yml, most likely in /opt/remnanode)',
};

export namespace StartXrayCommand {
    export const url = REST_API.XRAY.START;
    export const RequestSchema = z.object({
        internals: z.object(
            {
                forceRestart: z.boolean().default(false),
                hashes: z.object({
                    emptyConfig: z.string(),
                    inbounds: z.array(
                        z.object({
                            usersCount: z.number(),
                            hash: z.string(),
                            tag: z.string(),
                        }),
                    ),
                }),
            },
            {
                errorMap: () => ({
                    ...UNSUPPORTED_REMNAWAVE_VERSION_MESSAGE,
                }),
            },
        ),
        xrayConfig: z.record(z.unknown(), {
            errorMap: () => ({
                ...UNSUPPORTED_REMNAWAVE_VERSION_MESSAGE,
            }),
        }),
    });

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
