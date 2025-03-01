import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const configSchema = z.object({
    APP_PORT: z
        .string()
        .default('3000')
        .transform((port) => parseInt(port, 10)),
    SSL_CERT: z.string(),
    XTLS_IP: z.string().default('127.0.0.1'),
    XTLS_PORT: z.string().default('61000'),
    CONFIG_EQUAL_CHECKING: z
        .string()
        .default('true')
        .transform((val) => val === 'true'),
});

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
