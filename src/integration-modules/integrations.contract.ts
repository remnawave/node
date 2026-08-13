export const NODE_INTEGRATIONS = 'NODE_INTEGRATIONS' as const;

export interface INodeIntegrationResult {
    error: null | string;
}

export interface INodeIntegration {
    readonly name: string;

    sync(coreConfig: unknown): Promise<INodeIntegrationResult>;

    stop(): Promise<void>;
}
