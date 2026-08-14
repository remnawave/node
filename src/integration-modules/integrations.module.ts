import { Global, Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';

import {
    INodeIntegration,
    INodeIntegrationDescriptor,
    NODE_INTEGRATIONS,
} from './integrations.contract';
import { IntegrationsService } from './integrations.service';

const context = require.context('./', true, /\.integration\.ts$/);

const DESCRIPTORS: INodeIntegrationDescriptor[] = context
    .keys()
    .map((key) => (context(key) as { descriptor: INodeIntegrationDescriptor }).descriptor);

@Global()
@Module({
    imports: DESCRIPTORS.map((descriptor) =>
        ConditionalModule.registerWhen(descriptor.module, descriptor.isAvailable, { debug: false }),
    ),
    providers: [
        IntegrationsService,
        {
            provide: NODE_INTEGRATIONS,
            useFactory: (...integrations: (INodeIntegration | undefined)[]) =>
                integrations.filter((integration) => integration !== undefined),
            inject: DESCRIPTORS.map((descriptor) => ({
                token: descriptor.service,
                optional: true,
            })),
        },
    ],
    exports: [IntegrationsService],
})
export class IntegrationsModule {}
