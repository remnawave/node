import { createZodDto } from 'nestjs-zod';

import { AddUsersCommand } from '@libs/contracts/commands/handler';

export class AddUsersRequestDto extends createZodDto(AddUsersCommand.RequestSchema) {}
export class AddUsersResponseDto extends createZodDto(AddUsersCommand.ResponseSchema) {}
