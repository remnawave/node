import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InternalModule } from '../internal/internal.module';
import { XrayProcessService } from './xray-process.service';
import { XrayController } from './xray.controller';
import { XrayService } from './xray.service';
import { COMMANDS } from './commands';

@Module({
    imports: [InternalModule, CqrsModule],
    providers: [XrayService, XrayProcessService, ...COMMANDS],
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
