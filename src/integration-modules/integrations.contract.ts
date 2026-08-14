import { Type } from '@nestjs/common';

import { TNodeMetadata as TNodeMetadataContract } from '@libs/contracts/models';

export const NODE_INTEGRATIONS = 'NODE_INTEGRATIONS' as const;

export type TNodeMetadata = TNodeMetadataContract;

export interface INodeIntegrationResult {
    error: null | string;
}

export interface INodeIntegrationStartOptions {
    integrationConfig: Record<string, unknown>;
    nodeMetadata: TNodeMetadata;
}

export interface INodeIntegration {
    readonly name: string;

    sync(options: INodeIntegrationStartOptions): Promise<INodeIntegrationResult>;

    stop(): Promise<void>;
}

export interface INodeIntegrationDescriptor {
    module: Type;
    service: Type<INodeIntegration>;
    isAvailable: () => boolean;
}
