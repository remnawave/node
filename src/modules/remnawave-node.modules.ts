import { Module } from '@nestjs/common';
import { StatsModule } from './stats/stats.module';
import { XrayModule } from './xray-core/xray.module';
import { HandlerModule } from './handler/handler.module';

@Module({
    imports: [StatsModule, XrayModule, HandlerModule],
    providers: [],
})
export class RemnawaveNodeModules {}
