import { createZodDto } from 'nestjs-zod';

import { GetGeocheckCommand } from '@libs/contracts/commands';

export class GetGeocheckRequestDto extends createZodDto(GetGeocheckCommand.RequestSchema) {}
export class GetGeocheckResponseDto extends createZodDto(GetGeocheckCommand.ResponseSchema) {}
