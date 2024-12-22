import { createZodDto } from 'nestjs-zod';

import { GetAllInboundsStatsCommand, GetAllOutboundsStatsCommand } from '@libs/contracts/commands';

export class GetAllOutboundsStatsRequestDto extends createZodDto(
    GetAllInboundsStatsCommand.RequestSchema,
) {}
export class GetAllOutboundsStatsResponseDto extends createZodDto(
    GetAllOutboundsStatsCommand.ResponseSchema,
) {}
