import { Command } from '@nestjs/cqrs';

export class RunPreStartCommand extends Command<void> {
    constructor() {
        super();
    }
}
