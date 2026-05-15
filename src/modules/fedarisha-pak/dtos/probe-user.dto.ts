import { createZodDto } from 'nestjs-zod';

import { ProbeFedarishaUserCommand } from '@libs/contracts/commands';

export class ProbeFedarishaUserRequestDto extends createZodDto(
    ProbeFedarishaUserCommand.RequestSchema,
) {}
export class ProbeFedarishaUserResponseDto extends createZodDto(
    ProbeFedarishaUserCommand.ResponseSchema,
) {}
