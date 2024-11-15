import { Module, OnApplicationShutdown } from '@nestjs/common';
import { XrayService } from './xray.service';
import { XrayController } from './xray.controller';

@Module({
    imports: [],
    providers: [XrayService],
    controllers: [XrayController],
})
export class XrayModule implements OnApplicationShutdown {
    constructor(private readonly xrayService: XrayService) {}

    async onApplicationShutdown() {
        await this.xrayService.stopXray();
    }
}
