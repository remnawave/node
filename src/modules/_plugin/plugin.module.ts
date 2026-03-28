import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { PluginStateService } from './services/plugin-state.service';
import { PluginController } from './plugin.controller';
import { NftService } from './services/nft.service';
import { PluginService } from './plugin.service';
import { COMMANDS } from './commands';
import { QUERIES } from './queries';
import { EVENTS } from './events';

@Module({
    imports: [CqrsModule],
    controllers: [PluginController],
    providers: [PluginService, PluginStateService, NftService, ...QUERIES, ...EVENTS, ...COMMANDS],
    exports: [PluginStateService],
})
export class PluginModule {}
