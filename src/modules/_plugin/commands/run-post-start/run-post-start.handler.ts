import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PostStartService } from '../../services/post-start.service';
import { RunPostStartCommand } from './run-post-start.command';

@CommandHandler(RunPostStartCommand)
export class RunPostStartHandler implements ICommandHandler<RunPostStartCommand> {
    public readonly logger = new Logger(RunPostStartHandler.name);

    constructor(private readonly postStartService: PostStartService) {}

    async execute(command: RunPostStartCommand) {
        try {
            this.postStartService.run(command.metadata);
            return;
        } catch (error) {
            this.logger.error(error);
            return;
        }
    }
}
