import { Global, Module } from '@nestjs/common';

import { INodeIntegration, NODE_INTEGRATIONS } from './integrations.contract';
import { IntegrationsService } from './integrations.service';

@Global()
@Module({
    imports: [],
    providers: [
        IntegrationsService,
        {
            provide: NODE_INTEGRATIONS,
            useFactory: (...integrations: (INodeIntegration | undefined)[]) =>
                integrations.filter((integration) => integration !== undefined),
            inject: [],
        },
    ],
    exports: [IntegrationsService],
})
export class IntegrationsModule {}
