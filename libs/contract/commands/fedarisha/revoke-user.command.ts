import { z } from 'zod';

import { REST_API } from '../../api';

// Revoke the per-user prefix-scoped S3 access key on the bucket bound to the
// fedarisha xray inbound on this node. Idempotent: missing key on the bucket
// is not an error.
export namespace RevokeFedarishaUserCommand {
    export const url = REST_API.FEDARISHA.REVOKE_USER;

    export const RequestSchema = z.object({
        userUuid: z.string().uuid(),
        inboundTag: z.string().min(1),
        prefix: z.string().min(1),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isOk: z.boolean(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
