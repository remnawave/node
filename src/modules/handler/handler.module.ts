import { Module } from '@nestjs/common';

import { InternalModule } from '../internal/internal.module';
import { HandlerController } from './handler.controller';
import { XrayModule } from '../xray-core/xray.module';
import { HandlerService } from './handler.service';

@Module({
    imports: [XrayModule, InternalModule],
    controllers: [HandlerController],
    providers: [HandlerService],
})
export class HandlerModule { }
