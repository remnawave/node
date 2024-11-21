import { createZodDto } from 'nestjs-zod';
import { GetAllInboundsStatsCommand } from '@libs/contracts/commands';

export class GetAllInboundsStatsRequestDto extends createZodDto(
    GetAllInboundsStatsCommand.RequestSchema,
) {}
export class GetAllInboundsStatsResponseDto extends createZodDto(
    GetAllInboundsStatsCommand.ResponseSchema,
) {}
