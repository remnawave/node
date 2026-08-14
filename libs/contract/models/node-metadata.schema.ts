import { z } from 'zod';

export const NodeMetadataSchema = z.object({
    name: z.string(),
    uuid: z.string(),
    id: z.number(),
    tags: z.array(z.string()),
    countryCode: z.string(),
});

export type TNodeMetadata = z.infer<typeof NodeMetadataSchema>;
