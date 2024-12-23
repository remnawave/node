import { Global, Module } from '@nestjs/common';

import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Global()
@Module({
    imports: [],
    providers: [InternalService],
    controllers: [InternalController],
    exports: [InternalService],
})
export class InternalModule {}
