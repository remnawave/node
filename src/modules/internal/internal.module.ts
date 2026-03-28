import {
    Global,
    Logger,
    MiddlewareConsumer,
    Module,
    NestModule,
    OnApplicationShutdown,
} from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { TokenAuthMiddleware } from '@common/middlewares';

import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Global()
@Module({
    imports: [CqrsModule],
    providers: [InternalService],
    controllers: [InternalController],
    exports: [InternalService],
})
export class InternalModule implements NestModule, OnApplicationShutdown {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TokenAuthMiddleware).forRoutes(InternalController);
    }
    private readonly logger = new Logger(InternalModule.name);

    async onApplicationShutdown(signal?: string): Promise<void> {
        this.logger.log(`${signal} received, shutting down...`);
    }
}
