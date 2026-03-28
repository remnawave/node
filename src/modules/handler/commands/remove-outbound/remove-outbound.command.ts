import { Command } from '@nestjs/cqrs';

export class RemoveOutboundCommand extends Command<void> {
    constructor(public readonly tag: string) {
        super();
    }
}
