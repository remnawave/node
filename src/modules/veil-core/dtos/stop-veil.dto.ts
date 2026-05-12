import { createZodDto } from 'nestjs-zod';

import { StopVeilCommand } from '@libs/contracts/commands';

export class StopVeilResponseDto extends createZodDto(StopVeilCommand.ResponseSchema) {}
