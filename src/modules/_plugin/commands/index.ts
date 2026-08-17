import { ResetPluginsHandler } from './reset-plugins/reset-plugins.handler';
import { RunPreStartHandler } from './run-pre-start/run-pre-start.handler';
import { SetAbuseBlockerCoverageHandler } from './set-abuse-blocker-coverage';

export const COMMANDS = [ResetPluginsHandler, RunPreStartHandler, SetAbuseBlockerCoverageHandler];
