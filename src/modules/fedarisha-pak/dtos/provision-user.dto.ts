import { createZodDto } from 'nestjs-zod';

import { ProvisionFedarishaUserCommand } from '@libs/contracts/commands';

export class ProvisionFedarishaUserRequestDto extends createZodDto(
    ProvisionFedarishaUserCommand.RequestSchema,
) {}
export class ProvisionFedarishaUserResponseDto extends createZodDto(
    ProvisionFedarishaUserCommand.ResponseSchema,
) {}
