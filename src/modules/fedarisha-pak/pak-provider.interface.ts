import { IPakCreateResult } from './pak.service';

// Provider-agnostic shape returned by createKey. Re-exported so callers don't
// need to know which concrete provider produced the credentials.
export type { IPakCreateResult };

// Common S3 endpoint surface shared by every provider (VK Cloud PAK,
// Selectel IAM, …). Provider-specific auth lives on the concrete storage
// type below.
export interface IPakEndpoint {
    bucket: string;
    endpoint: string;
    region: string;
}

// Shape every PAK provider implements. `storage` is intentionally `unknown`
// at the interface level — each provider casts it to its own typed config.
// This keeps the dispatcher (`FedarishaPakService`) free of provider-
// specific knowledge beyond the discriminator `storage.type`.
export interface IPakProvider {
    readonly type: string;

    createKey(storage: unknown, userName: string, prefix: string): Promise<IPakCreateResult>;
    deleteKey(storage: unknown, userName: string, prefix: string): Promise<void>;
    probeKey(
        storage: unknown,
        accessKey: string,
        secretKey: string,
        prefix: string,
    ): Promise<boolean>;
}

// Signals that a provider was asked to operate on credentials that already
// exist (VK Cloud UserAlreadyExists, Selectel duplicate service user). The
// caller is expected to delete and retry — see `createWithReclaim` in
// `FedarishaPakService`.
export class PakProviderConflictError extends Error {
    constructor(
        public readonly providerType: string,
        public readonly userName: string,
        message?: string,
    ) {
        super(message ?? `${providerType} provider conflict for user ${userName}`);
        this.name = 'PakProviderConflictError';
    }
}
