import { createZodDto } from 'nestjs-zod';
import { AddUserCommand } from '@libs/contracts/commands/handler';

export class AddUserRequestDto extends createZodDto(AddUserCommand.RequestSchema) {}
export class AddUserResponseDto extends createZodDto(AddUserCommand.ResponseSchema) {}
