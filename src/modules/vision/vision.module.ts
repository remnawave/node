import { Module } from '@nestjs/common';

import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';

@Module({
    imports: [],
    controllers: [VisionController],
    providers: [VisionService],
})
export class VisionModule {}
