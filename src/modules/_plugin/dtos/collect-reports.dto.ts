import { createZodDto } from 'nestjs-zod';

import { CollectReportsCommand } from '@libs/contracts/commands/plugin';

export class CollectReportsResponseDto extends createZodDto(CollectReportsCommand.ResponseSchema) {}
