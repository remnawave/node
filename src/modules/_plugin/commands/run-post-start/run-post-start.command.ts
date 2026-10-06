import { Command } from '@nestjs/cqrs';

import { TNodeMetadata } from '@libs/contracts/models';

export class RunPostStartCommand extends Command<void> {
    constructor(public readonly metadata: TNodeMetadata | undefined) {
        super();
    }
}
