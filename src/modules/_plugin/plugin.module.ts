import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { COMMANDS } from './commands';
import { EVENTS } from './events';
import { PluginController } from './plugin.controller';
import { PluginService } from './plugin.service';
import { QUERIES } from './queries';
import { NftService } from './services/nft.service';
import { PluginStateService } from './services/plugin-state.service';
import { PreStartService } from './services/pre-start.service';

@Module({
    imports: [CqrsModule],
    controllers: [PluginController],
    providers: [
        PluginService,
        PluginStateService,
        NftService,
        PreStartService,
        ...QUERIES,
        ...EVENTS,
        ...COMMANDS,
    ],
    exports: [PluginStateService],
})
export class PluginModule {}
