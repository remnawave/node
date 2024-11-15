import { createZodDto } from 'nestjs-zod';
import { GetInboundUsersCommand } from '@libs/contracts/commands/handler';

export class GetInboundUsersRequestDto extends createZodDto(GetInboundUsersCommand.RequestSchema) {}
export class GetInboundUsersResponseDto extends createZodDto(
    GetInboundUsersCommand.ResponseSchema,
) {}
