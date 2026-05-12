import { Command } from '@nestjs/cqrs';

import { ICommandResponse } from '@common/types/command-response.type';

import { StopVeilResponseModel } from '../../models';

export class StopVeilCommand extends Command<ICommandResponse<StopVeilResponseModel>> {
    constructor(
        public readonly args: { withOnlineCheck?: boolean } = {},
    ) {
        super();
    }
}
