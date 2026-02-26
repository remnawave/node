import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';

import { HandlerModule } from './handler/handler.module';
import { PluginModule } from './_plugin/plugin.module';
import { XrayModule } from './xray-core/xray.module';
import { StatsModule } from './stats/stats.module';

@Module({
    imports: [PluginModule, StatsModule, XrayModule, HandlerModule],
    providers: [],
})
export class RemnawaveNodeModules implements OnApplicationShutdown {
    private readonly logger = new Logger(RemnawaveNodeModules.name);

    async onApplicationShutdown(signal?: string): Promise<void> {
        this.logger.log(`${signal} received, shutting down...`);
    }
}
