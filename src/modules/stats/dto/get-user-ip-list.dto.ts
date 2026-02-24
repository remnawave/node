import { createZodDto } from 'nestjs-zod';

import { GetUserIpListCommand } from '@libs/contracts/commands';

export class GetUserIpListRequestDto extends createZodDto(GetUserIpListCommand.RequestSchema) {}
export class GetUserIpListResponseDto extends createZodDto(GetUserIpListCommand.ResponseSchema) {}
