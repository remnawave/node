import { z } from 'zod';

export const HostInfoSchema = z.object({
    arch: z.string(),
    cpus: z.number().int(),
    cpuModel: z.string(),
    memoryTotal: z.number(),
    hostname: z.string(),
    platform: z.string(),
    release: z.string(),
    type: z.string(),
    version: z.string(),
    networkInterfaces: z.array(z.string()),
});

export type THostInfo = z.infer<typeof HostInfoSchema>;

export const HotHostInfoSchema = z.object({
    memoryFree: z.number(),
    uptime: z.number(),
});

export type THotHostInfo = z.infer<typeof HotHostInfoSchema>;
