import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';

import { HandlerModule } from './handler/handler.module';
import { VisionModule } from './vision/vision.module';
import { XrayModule } from './xray-core/xray.module';
import { StatsModule } from './stats/stats.module';

@Module({
    imports: [StatsModule, XrayModule, HandlerModule, VisionModule],
    providers: [],
})
export class RemnawaveNodeModules implements OnApplicationShutdown {
    private readonly logger = new Logger(RemnawaveNodeModules.name);

    async onApplicationShutdown(signal?: string): Promise<void> {
        this.logger.log(`${signal} received, shutting down...`);
    }
}
