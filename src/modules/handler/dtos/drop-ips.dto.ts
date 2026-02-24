import { createZodDto } from 'nestjs-zod';

import { DropIpsCommand } from '@libs/contracts/commands/handler';

export class DropIpsRequestDto extends createZodDto(DropIpsCommand.RequestSchema) {}
export class DropIpsResponseDto extends createZodDto(DropIpsCommand.ResponseSchema) {}
