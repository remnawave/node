import { Query } from '@nestjs/cqrs';

import { IInterfaceRate } from '../../interfaces';

export class GetInterfaceStatsQuery extends Query<IInterfaceRate | null> {
    constructor() {
        super();
    }
}
