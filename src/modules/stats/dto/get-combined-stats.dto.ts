import { createZodDto } from 'nestjs-zod';

import { GetCombinedStatsCommand } from '@libs/contracts/commands';

export class GetCombinedStatsRequestDto extends createZodDto(
    GetCombinedStatsCommand.RequestSchema,
) {}
export class GetCombinedStatsResponseDto extends createZodDto(
    GetCombinedStatsCommand.ResponseSchema,
) {}
