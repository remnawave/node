import { Query } from '@nestjs/cqrs';

export class GetTorrentBlockerStateQuery extends Query<{
    enabled: boolean;
    includeRuleTags: Set<string>;
    rulePosition: number;
}> {
    constructor() {
        super();
    }
}
