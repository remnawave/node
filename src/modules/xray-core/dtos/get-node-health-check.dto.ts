import { createZodDto } from 'nestjs-zod';

import { GetNodeHealthCheckCommand } from '@libs/contracts/commands';

export class GetNodeHealthCheckResponseDto extends createZodDto(
    GetNodeHealthCheckCommand.ResponseSchema,
) {}
