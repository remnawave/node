import { z, ZodError } from 'zod';

export function validateEnvConfig<T>(schema: z.ZodType<T>, config: Record<string, unknown>): T {
    try {
        return schema.parse(config);
    } catch (e) {
        if (e instanceof ZodError) {
            const formattedErrors = e.issues
                .map((issue) => `❌ ${issue.path.join('.')}: ${issue.message}`)
                .join('\n');

            const errorMessage = `
🔧 Environment Configuration Errors:
${formattedErrors}

Please fix your .env file and restart the application.`;

            const error = new Error(errorMessage);
            error.stack = '';
            throw error;
        }

        const error = new Error(`.env configuration validation error: ${e}`);
        error.stack = '';
        throw error;
    }
}
