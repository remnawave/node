import { Module } from '@nestjs/common';

import { HandlerModule } from './handler/handler.module';
import { XrayModule } from './xray-core/xray.module';
import { StatsModule } from './stats/stats.module';

@Module({
    imports: [StatsModule, XrayModule, HandlerModule],
    providers: [],
})
export class RemnawaveNodeModules {}
