import { z } from 'zod';

import { REST_API } from '../../api';

// Verify the supplied user-scoped PAK still authenticates against the bucket
// the fedarisha inbound currently serves on this node. The node resolves
// bucket / endpoint / region from the live xray runtime config (so admin-side
// bucket swaps are detected for free) and issues a cheap auth-touching S3
// call (HeadBucket / ListObjectsV2 with MaxKeys=1) using the supplied creds.
//
// `exists: false` means the request reached S3 but the credentials were
// rejected (deleted PAK, revoked permissions, prefix wiped). `exists: true`
// + `isOk: true` is the only "fresh" combination — anything else makes the
// panel re-issue the PAK silently.
export namespace ProbeFedarishaUserCommand {
    export const url = REST_API.FEDARISHA.PROBE_USER;

    export const RequestSchema = z.object({
        userUuid: z.string().uuid(),
        inboundTag: z.string().min(1),
        prefix: z.string().min(1),
        accessKey: z.string().min(1),
        secretKey: z.string().min(1),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            isOk: z.boolean(),
            exists: z.boolean(),
            error: z.string().nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
