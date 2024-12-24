import { Module, OnModuleDestroy } from '@nestjs/common';

import { InternalModule } from '../internal/internal.module';
import { XrayController } from './xray.controller';
import { XrayService } from './xray.service';

@Module({
    imports: [InternalModule],
    providers: [XrayService],
    controllers: [XrayController],
    exports: [],
})
export class XrayModule implements OnModuleDestroy {
    constructor(private readonly xrayService: XrayService) {}

    async onModuleDestroy() {
        await this.xrayService.killAllXrayProcesses();
    }
}
