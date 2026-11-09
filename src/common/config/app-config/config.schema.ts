import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { parseNodePayloadFromConfigService } from '@common/utils/decode-node-payload';

const booleanString = (def: 'true' | 'false' = 'false') =>
    z
        .string()
        .default(def)
        .transform((val) => (val === '' ? def : val))
        .refine((val) => val === 'true' || val === 'false', 'Must be "true" or "false".')
        .transform((val) => val === 'true')
        .pipe(z.boolean());

export const configSchema = z
    .object({
        NODE_PORT: z.string().transform((port) => {
            return parseInt(port, 10);
        }),
        SECRET_KEY: z.string(),
        JWT_PUBLIC_KEY: z.string().optional(),
        DISABLE_HASHED_SET_CHECK: booleanString(),
        INTERNAL_REST_TOKEN: z.string(),
        INTERNAL_SOCKET_PATH: z.string(),
        XTLS_API_SOCKET_PATH: z.string(),
        NFTABLES_TABLE_NAME: z
            .string()
            .default('remnanode')
            .transform((val) => (val.trim() === '' ? 'remnanode' : val.trim()))
            .refine(
                (val) => /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(val),
                'Must start with a letter or underscore and contain only letters, digits, "_" or "-" (max 63 chars).',
            ),
        NFTABLES_LOGGING: booleanString('true'),
        NFTABLES_ACCEPT_REPLY_TRAFFIC: booleanString('false'),
        SNI_VERIFICATION: booleanString('false'),
        SUPPRESS_DUPLICATE_INSTANCE_WARNING: booleanString('false'),
    })

    .superRefine((data, ctx) => {
        if (data.SECRET_KEY) {
            try {
                const parsed = parseNodePayloadFromConfigService(data.SECRET_KEY);
                data.JWT_PUBLIC_KEY = parsed.jwtPublicKey;
            } catch {
                ctx.issues.push({
                    code: 'custom',
                    input: data.SECRET_KEY,
                    message: 'Invalid SECRET_KEY payload',
                });
            }
        }
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
