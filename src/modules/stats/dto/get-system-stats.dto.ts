import { createZodDto } from 'nestjs-zod';
import { GetSystemStatsCommand } from '@libs/contracts/commands';

export class GetSystemStatsResponseDto extends createZodDto(GetSystemStatsCommand.ResponseSchema) {}
