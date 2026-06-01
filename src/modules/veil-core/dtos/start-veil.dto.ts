import { createZodDto } from 'nestjs-zod';

import { StartVeilCommand } from '@libs/contracts/commands';

export class StartVeilRequestDto extends createZodDto(StartVeilCommand.RequestSchema) {}
export class StartVeilResponseDto extends createZodDto(StartVeilCommand.ResponseSchema) {}
