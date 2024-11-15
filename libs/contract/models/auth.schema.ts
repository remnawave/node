import { z } from 'zod';

export const AuthSchema = z.object({
    hash: z.string(),
});
