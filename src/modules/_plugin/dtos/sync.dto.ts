import { createZodDto } from 'nestjs-zod';

import { SyncCommand } from '@libs/contracts/commands/plugin';

export class SyncRequestDto extends createZodDto(SyncCommand.RequestSchema) {}
export class SyncResponseDto extends createZodDto(SyncCommand.ResponseSchema) {}
