import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const configSchema = z.object({
    APP_PORT: z
        .string()
        .default('3000')
        .transform((port) => parseInt(port, 10)),
    API_PREFIX: z.string().default('api/v1'),
    NODE_ENV: z.string(),
    SSL_CERT: z.string(),
    XTLS_IP: z.string().default('127.0.0.1'),
    XTLS_PORT: z.string().default('61000'),
});

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
