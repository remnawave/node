import { createZodDto } from 'nestjs-zod';

import { DropUsersConnectionsCommand } from '@libs/contracts/commands/handler';

export class DropUsersConnectionsRequestDto extends createZodDto(
    DropUsersConnectionsCommand.RequestSchema,
) {}
export class DropUsersConnectionsResponseDto extends createZodDto(
    DropUsersConnectionsCommand.ResponseSchema,
) {}
