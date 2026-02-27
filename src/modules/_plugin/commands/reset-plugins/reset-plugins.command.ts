import { Command } from '@nestjs/cqrs';

export class ResetPluginsCommand extends Command<void> {
    constructor() {
        super();
    }
}
