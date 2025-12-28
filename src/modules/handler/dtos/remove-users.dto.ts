import { createZodDto } from 'nestjs-zod';

import { RemoveUsersCommand } from '@libs/contracts/commands/handler';

export class RemoveUsersRequestDto extends createZodDto(RemoveUsersCommand.RequestSchema) {}
export class RemoveUsersResponseDto extends createZodDto(RemoveUsersCommand.ResponseSchema) {}
