import { createZodDto } from 'nestjs-zod';

import { GetNodeHealthCheckVeilCommand } from '@libs/contracts/commands';

export class GetNodeHealthCheckVeilResponseDto extends createZodDto(
    GetNodeHealthCheckVeilCommand.ResponseSchema,
) {}
