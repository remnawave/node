import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { StopXrayCommand } from './stop-xray.command';
import { XrayService } from '../../xray.service';

@CommandHandler(StopXrayCommand)
export class StopXrayHandler implements ICommandHandler<StopXrayCommand> {
    public readonly logger = new Logger(StopXrayHandler.name);

    constructor(private readonly xrayService: XrayService) {}

    async execute(command: StopXrayCommand) {
        try {
            await this.xrayService.stopXray(command.args);

            return;
        } catch (error) {
            this.logger.error(error);
            return;
        }
    }
}
