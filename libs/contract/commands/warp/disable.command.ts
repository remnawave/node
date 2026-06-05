import { z } from 'zod';

import { WarpStatusSchema } from '../../models';
import { REST_API } from '../../api';

export namespace DisableWarpCommand {
    export const url = REST_API.WARP.DISABLE;

    export const ResponseSchema = z.object({
        response: WarpStatusSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
