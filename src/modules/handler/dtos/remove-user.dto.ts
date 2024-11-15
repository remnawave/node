import { createZodDto } from 'nestjs-zod';
import { RemoveUserCommand } from '@libs/contracts/commands/handler';

export class RemoveUserRequestDto extends createZodDto(RemoveUserCommand.RequestSchema) {}
export class RemoveUserResponseDto extends createZodDto(RemoveUserCommand.ResponseSchema) {}
