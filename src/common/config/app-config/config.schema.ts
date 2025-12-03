import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { parseNodePayloadFromConfigService } from '@common/utils/decode-node-payload';

export const configSchema = z
    .object({
        NODE_PORT: z.string().transform((port) => {
            return parseInt(port, 10);
        }),
        SECRET_KEY: z.string(),
        JWT_PUBLIC_KEY: z.string().optional(),
        XTLS_IP: z.string().default('127.0.0.1'),
        XTLS_PORT: z.string().default('61000'),
        DISABLE_HASHED_SET_CHECK: z
            .string()
            .default('false')
            .transform((val) => val === 'true'),
    })
    .superRefine((data, ctx) => {
        if (data.SECRET_KEY) {
            try {
                const parsed = parseNodePayloadFromConfigService(data.SECRET_KEY);
                data.JWT_PUBLIC_KEY = parsed.jwtPublicKey;
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Invalid SECRET_KEY payload',
                });
            }
        }
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
