import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { GetAsnPrefixesQuery } from './get-asn-prefixes.query';
import { AsnLmdbService } from '../../asn-lmdb.service';

@QueryHandler(GetAsnPrefixesQuery)
export class GetAsnPrefixesHandler implements IQueryHandler<GetAsnPrefixesQuery> {
    private readonly logger = new Logger(GetAsnPrefixesHandler.name);
    constructor(private readonly asnLmdbService: AsnLmdbService) {}

    async execute(query: GetAsnPrefixesQuery) {
        return this.asnLmdbService.getByAsn(query.asn);
    }
}
