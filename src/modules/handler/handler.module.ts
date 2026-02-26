import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { HandlerController } from './handler.controller';
import { HandlerService } from './handler.service';
@Module({
    imports: [CqrsModule],
    controllers: [HandlerController],
    providers: [HandlerService],
})
export class HandlerModule {}
