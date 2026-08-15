import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PluginStateService } from '../../services/plugin-state.service';
import { SetAbuseBlockerCoverageCommand } from './set-abuse-blocker-coverage.command';

@CommandHandler(SetAbuseBlockerCoverageCommand)
export class SetAbuseBlockerCoverageHandler implements ICommandHandler<SetAbuseBlockerCoverageCommand> {
    constructor(private readonly pluginState: PluginStateService) {}

    async execute(command: SetAbuseBlockerCoverageCommand): Promise<void> {
        this.pluginState.abuseBlocker.setCoverage(command.mode, command.skippedWebhookRules);
    }
}
