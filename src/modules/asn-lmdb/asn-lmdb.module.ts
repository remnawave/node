import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { AsnLmdbService } from './asn-lmdb.service';
import { QUERIES } from './queries';

@Module({
    imports: [CqrsModule],
    providers: [AsnLmdbService, ...QUERIES],
    exports: [AsnLmdbService],
})
export class AsnLmdbModule {}
