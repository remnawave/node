import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PreStartService } from '../../services/pre-start.service';
import { RunPreStartCommand } from './run-pre-start.command';

@CommandHandler(RunPreStartCommand)
export class RunPreStartHandler implements ICommandHandler<RunPreStartCommand> {
    public readonly logger = new Logger(RunPreStartHandler.name);

    constructor(private readonly preStartService: PreStartService) {}

    async execute() {
        try {
            await this.preStartService.run();
            return;
        } catch (error) {
            this.logger.error(error);
            return;
        }
    }
}
