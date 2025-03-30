import { Module } from '@nestjs/common';

import { HandlerController } from './handler.controller';
import { XrayModule } from '../xray-core/xray.module';
import { HandlerService } from './handler.service';
@Module({
    imports: [XrayModule],
    controllers: [HandlerController],
    providers: [HandlerService],
})
export class HandlerModule {}
