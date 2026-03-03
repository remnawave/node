import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { RemoveOutboundCommand } from './remove-outbound.command';
import { HandlerService } from '../../handler.service';

@CommandHandler(RemoveOutboundCommand)
export class RemoveOutboundHandler implements ICommandHandler<RemoveOutboundCommand> {
    public readonly logger = new Logger(RemoveOutboundHandler.name);

    constructor(private readonly handlerService: HandlerService) {}

    async execute(command: RemoveOutboundCommand) {
        try {
            await this.handlerService.removeOutbound(command.tag);

            return;
        } catch (error) {
            this.logger.error(error);
            return;
        }
    }
}
