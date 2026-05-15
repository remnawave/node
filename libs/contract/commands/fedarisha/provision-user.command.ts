import { z } from 'zod';

import { REST_API } from '../../api';

// Provision a per-user prefix-scoped S3 access key on the bucket bound to the
// fedarisha xray inbound on this node. Master S3 keys live in the xray
// runtime config that the panel pushes; the panel addresses an inbound by tag
// and lets the node mint the sub-credentials.
export namespace ProvisionFedarishaUserCommand {
    export const url = REST_API.FEDARISHA.PROVISION_USER;

    export const RequestSchema = z.object({
        userUuid: z.string().uuid(),
        inboundTag: z.string().min(1),
        prefix: z.string().min(1),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isOk: z.boolean(),
            accessKey: z.string().nullable(),
            secretKey: z.string().nullable(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
