import { Module } from '@nestjs/common';

import { WarpController } from './warp.controller';
import { WarpService } from './warp.service';

@Module({
    controllers: [WarpController],
    providers: [WarpService],
    exports: [WarpService],
})
export class WarpModule {}
