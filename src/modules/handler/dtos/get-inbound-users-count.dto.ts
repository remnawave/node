import { createZodDto } from 'nestjs-zod';

import { GetInboundUsersCountCommand } from '@libs/contracts/commands/handler';

export class GetInboundUsersCountRequestDto extends createZodDto(
    GetInboundUsersCountCommand.RequestSchema,
) {}
export class GetInboundUsersCountResponseDto extends createZodDto(
    GetInboundUsersCountCommand.ResponseSchema,
) {}
