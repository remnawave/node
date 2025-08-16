import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';

import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Global()
@Module({
    imports: [],
    providers: [InternalService],
    controllers: [InternalController],
    exports: [InternalService],
})
export class InternalModule implements OnApplicationShutdown {
    private readonly logger = new Logger(InternalModule.name);

    async onApplicationShutdown(signal?: string): Promise<void> {
        this.logger.log(`${signal} received, shutting down...`);
    }
}
