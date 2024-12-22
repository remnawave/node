import { createZodDto } from 'nestjs-zod';

import { StartXrayCommand } from '@libs/contracts/commands';

export class StartXrayRequestDto extends createZodDto(StartXrayCommand.RequestSchema) {}
export class StartXrayResponseDto extends createZodDto(StartXrayCommand.ResponseSchema) {}
