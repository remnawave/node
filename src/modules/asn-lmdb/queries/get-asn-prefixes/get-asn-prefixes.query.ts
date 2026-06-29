import { Query } from '@nestjs/cqrs';

import { IAsnPrefixes } from '../../interfaces';

export class GetAsnPrefixesQuery extends Query<IAsnPrefixes | null> {
    constructor(public readonly asn: number) {
        super();
    }
}
