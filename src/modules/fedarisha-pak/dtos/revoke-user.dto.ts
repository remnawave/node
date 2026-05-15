import { createZodDto } from 'nestjs-zod';

import { RevokeFedarishaUserCommand } from '@libs/contracts/commands';

export class RevokeFedarishaUserRequestDto extends createZodDto(
    RevokeFedarishaUserCommand.RequestSchema,
) {}
export class RevokeFedarishaUserResponseDto extends createZodDto(
    RevokeFedarishaUserCommand.ResponseSchema,
) {}
