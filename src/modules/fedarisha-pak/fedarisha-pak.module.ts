import { Module } from '@nestjs/common';

import { FedarishaPakController } from './fedarisha-pak.controller';
import { FedarishaPakService } from './fedarisha-pak.service';
import { PakService } from './pak.service';

@Module({
    providers: [FedarishaPakService, PakService],
    controllers: [FedarishaPakController],
    exports: [FedarishaPakService],
})
export class FedarishaPakModule {}
