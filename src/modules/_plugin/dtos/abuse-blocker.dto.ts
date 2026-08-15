import { createZodDto } from 'nestjs-zod';

import {
    CollectAbuseBlockerReportsCommand,
    RefreshAbuseBlockCommand,
} from '@libs/contracts/commands/plugin';

export class CollectAbuseBlockerReportsResponseDto extends createZodDto(
    CollectAbuseBlockerReportsCommand.ResponseSchema,
) {}

export class RefreshAbuseBlockRequestDto extends createZodDto(
    RefreshAbuseBlockCommand.RequestSchema,
) {}

export class RefreshAbuseBlockResponseDto extends createZodDto(
    RefreshAbuseBlockCommand.ResponseSchema,
) {}
