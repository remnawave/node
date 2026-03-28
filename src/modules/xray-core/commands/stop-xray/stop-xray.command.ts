import { Command } from '@nestjs/cqrs';

export class StopXrayCommand extends Command<void> {
    constructor(public readonly args: { withPluginCleanup?: boolean; withOnlineCheck?: boolean }) {
        super();
    }
}
