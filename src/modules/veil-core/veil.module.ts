import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { COMMANDS } from './commands';
import { VeilController } from './veil.controller';
import { VeilService } from './veil.service';

@Module({
    imports: [CqrsModule],
    providers: [VeilService, ...COMMANDS],
    controllers: [VeilController],
    exports: [VeilService],
})
export class VeilModule implements OnModuleDestroy {
    private readonly logger = new Logger(VeilModule.name);

    constructor(private readonly veilService: VeilService) {}

    async onModuleDestroy() {
        this.logger.log('Destroying module.');

        await this.veilService.killAllVeilProcesses();
    }
}
