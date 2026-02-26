import { Command } from '@nestjs/cqrs';

export class StopXrayCommand extends Command<void> {
    constructor() {
        super();
    }
}
