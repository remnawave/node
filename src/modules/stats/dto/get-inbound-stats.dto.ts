import { createZodDto } from 'nestjs-zod';
import { GetInboundStatsCommand } from '@libs/contracts/commands';

export class GetInboundStatsRequestDto extends createZodDto(GetInboundStatsCommand.RequestSchema) {}
export class GetInboundStatsResponseDto extends createZodDto(
    GetInboundStatsCommand.ResponseSchema,
) {}
