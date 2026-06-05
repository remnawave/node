import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { StatsController } from './stats.controller';
import { WarpModule } from '../warp/warp.module';
import { StatsService } from './stats.service';
@Module({
    imports: [CqrsModule, WarpModule],
    providers: [StatsService],
    controllers: [StatsController],
})
export class StatsModule {}
