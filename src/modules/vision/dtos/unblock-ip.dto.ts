import { createZodDto } from 'nestjs-zod';

import { UnblockIpCommand } from '@libs/contracts/commands/vision';

export class UnblockIpRequestDto extends createZodDto(UnblockIpCommand.RequestSchema) {}
export class UnblockIpResponseDto extends createZodDto(UnblockIpCommand.ResponseSchema) {}
