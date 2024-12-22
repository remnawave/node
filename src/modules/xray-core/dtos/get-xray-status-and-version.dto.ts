import { createZodDto } from 'nestjs-zod';

import { GetStatusAndVersionCommand } from '@libs/contracts/commands';

export class GetXrayStatusAndVersionResponseDto extends createZodDto(
    GetStatusAndVersionCommand.ResponseSchema,
) {}
