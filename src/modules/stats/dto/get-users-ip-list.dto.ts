import { createZodDto } from 'nestjs-zod';

import { GetUsersIpListCommand } from '@libs/contracts/commands';

export class GetUsersIpListResponseDto extends createZodDto(GetUsersIpListCommand.ResponseSchema) {}
