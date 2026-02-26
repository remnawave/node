import { createZodDto } from 'nestjs-zod';

import {
    BlockIpsCommand,
    UnblockIpsCommand,
    RecreateTablesCommand,
} from '@libs/contracts/commands/plugin';

export class BlockIpsRequestDto extends createZodDto(BlockIpsCommand.RequestSchema) {}
export class BlockIpsResponseDto extends createZodDto(BlockIpsCommand.ResponseSchema) {}

export class UnblockIpsRequestDto extends createZodDto(UnblockIpsCommand.RequestSchema) {}
export class UnblockIpsResponseDto extends createZodDto(UnblockIpsCommand.ResponseSchema) {}

export class RecreateTablesResponseDto extends createZodDto(RecreateTablesCommand.ResponseSchema) {}
