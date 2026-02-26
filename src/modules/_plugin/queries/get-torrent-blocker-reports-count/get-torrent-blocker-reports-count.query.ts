import { Query } from '@nestjs/cqrs';

export class GetTorrentBlockerReportsCountQuery extends Query<number> {
    constructor() {
        super();
    }
}
