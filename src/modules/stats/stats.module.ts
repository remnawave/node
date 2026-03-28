import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
@Module({
    imports: [CqrsModule],
    providers: [StatsService],
    controllers: [StatsController],
})
export class StatsModule {}
