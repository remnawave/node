import { Module } from '@nestjs/common';
import { StatsModule } from './stats/stats.module';
import { XrayModule } from './xray-core/xray.module';

@Module({
    imports: [StatsModule, XrayModule],
    providers: [],
})
export class RemnawaveNodeModules {}
