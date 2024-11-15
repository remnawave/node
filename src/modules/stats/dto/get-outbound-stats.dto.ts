import { createZodDto } from 'nestjs-zod';
import { GetOutboundStatsCommand } from '@libs/contracts/commands';

export class GetOutboundStatsRequestDto extends createZodDto(
    GetOutboundStatsCommand.RequestSchema,
) {}
export class GetOutboundStatsResponseDto extends createZodDto(
    GetOutboundStatsCommand.ResponseSchema,
) {}
