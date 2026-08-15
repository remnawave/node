import type { AbuseBlockerCoverageMode } from '@libs/contracts/models';

export class SetAbuseBlockerCoverageCommand {
    constructor(
        public readonly mode: AbuseBlockerCoverageMode,
        public readonly skippedWebhookRules: number,
    ) {}
}
