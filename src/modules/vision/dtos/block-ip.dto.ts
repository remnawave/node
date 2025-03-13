import { createZodDto } from 'nestjs-zod';

import { BlockIpCommand } from '@libs/contracts/commands/vision';

export class BlockIpRequestDto extends createZodDto(BlockIpCommand.RequestSchema) {}
export class BlockIpResponseDto extends createZodDto(BlockIpCommand.ResponseSchema) {}
