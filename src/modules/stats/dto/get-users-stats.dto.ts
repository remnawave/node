import { createZodDto } from 'nestjs-zod';
import { GetUsersStatsCommand } from '@libs/contracts/commands';

export class GetUsersStatsRequestDto extends createZodDto(GetUsersStatsCommand.RequestSchema) {}
export class GetUsersStatsResponseDto extends createZodDto(GetUsersStatsCommand.ResponseSchema) {}
