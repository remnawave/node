import { createZodDto } from 'nestjs-zod';

import { StopXrayCommand } from '@libs/contracts/commands';

export class StopXrayResponseDto extends createZodDto(StopXrayCommand.ResponseSchema) {}
