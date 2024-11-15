import { createZodDto } from 'nestjs-zod';
import { GetStatusAndVersionCommand } from '../../../../libs/contract/commands';

export class GetXrayStatusAndVersionResponseDto extends createZodDto(
    GetStatusAndVersionCommand.ResponseSchema,
) {}
