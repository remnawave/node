import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';

import { NetworkStatsModule } from './network-stats/network-stats.module';
import { HandlerModule } from './handler/handler.module';
import { PluginModule } from './_plugin/plugin.module';
import { XrayModule } from './xray-core/xray.module';
import { StatsModule } from './stats/stats.module';

@Module({
    imports: [NetworkStatsModule, PluginModule, StatsModule, XrayModule, HandlerModule],
    providers: [],
})
export class RemnawaveNodeModules implements OnApplicationShutdown {
    private readonly logger = new Logger(RemnawaveNodeModules.name);

    async onApplicationShutdown(signal?: string): Promise<void> {
        this.logger.log(`${signal} received, shutting down...`);
    }
}
