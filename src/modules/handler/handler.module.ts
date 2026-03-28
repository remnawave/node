import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { HandlerController } from './handler.controller';
import { HandlerService } from './handler.service';
import { COMMANDS } from './commands';
@Module({
    imports: [CqrsModule],
    controllers: [HandlerController],
    providers: [HandlerService, ...COMMANDS],
})
export class HandlerModule {}
