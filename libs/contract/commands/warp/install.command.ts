import { z } from 'zod';

import { WarpStatusSchema } from '../../models';
import { REST_API } from '../../api';

export namespace InstallWarpCommand {
    export const url = REST_API.WARP.INSTALL;

    export const ResponseSchema = z.object({
        response: WarpStatusSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
