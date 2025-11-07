import { Logger, Module, OnModuleDestroy } from '@nestjs/common';

import { InternalModule } from '../internal/internal.module';
import { XrayController } from './xray.controller';
import { XrayService } from './xray.service';

@Module({
    imports: [InternalModule],
    providers: [XrayService],
    controllers: [XrayController],
    exports: [XrayService],
})
export class XrayModule implements OnModuleDestroy {
    private readonly logger = new Logger(XrayModule.name);

    constructor(private readonly xrayService: XrayService) {}

    async onModuleDestroy() {
        this.logger.log('Destroying module.');

        await this.xrayService.killAllXrayProcesses();
    }
}
