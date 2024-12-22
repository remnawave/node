import { Module } from '@nestjs/common';

import { HandlerController } from './handler.controller';
import { HandlerService } from './handler.service';

@Module({
    imports: [],
    controllers: [HandlerController],
    providers: [HandlerService],
})
export class HandlerModule {}
