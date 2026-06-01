import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ICommandResponse } from '@common/types/command-response.type';

import { StopVeilResponseModel } from '../../models';
import { VeilService } from '../../veil.service';
import { StopVeilCommand } from './stop-veil.command';

@CommandHandler(StopVeilCommand)
export class StopVeilHandler
    implements ICommandHandler<StopVeilCommand, ICommandResponse<StopVeilResponseModel>>
{
    constructor(private readonly veilService: VeilService) {}

    async execute(command: StopVeilCommand): Promise<ICommandResponse<StopVeilResponseModel>> {
        return this.veilService.stopVeil({
            withOnlineCheck: command.args.withOnlineCheck ?? false,
        });
    }
}
