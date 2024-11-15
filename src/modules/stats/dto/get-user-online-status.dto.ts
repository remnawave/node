import { createZodDto } from 'nestjs-zod';
import { GetUserOnlineStatusCommand } from '@libs/contracts/commands';

export class GetUserOnlineStatusRequestDto extends createZodDto(
    GetUserOnlineStatusCommand.RequestSchema,
) {}
export class GetUserOnlineStatusResponseDto extends createZodDto(
    GetUserOnlineStatusCommand.ResponseSchema,
) {}
