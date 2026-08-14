import { Type } from '@nestjs/common';

import { TNodeMetadata } from '@libs/contracts/models';

export const NODE_INTEGRATIONS = 'NODE_INTEGRATIONS' as const;

export interface INodeIntegrationResult {
    error: null | string;
}

export interface INodeIntegration {
    readonly name: string;

    sync(
        integrationConfig: Record<string, unknown>,
        nodeMetadata: TNodeMetadata,
    ): Promise<INodeIntegrationResult>;

    stop(): Promise<void>;
}

export interface INodeIntegrationDescriptor {
    module: Type;
    service: Type<INodeIntegration>;
    isAvailable: () => boolean;
}
