import { Query } from '@nestjs/cqrs';

export class GetTorrentBlockerStateQuery extends Query<boolean> {
    constructor() {
        super();
    }
}
