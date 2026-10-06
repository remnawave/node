import { ResetPluginsHandler } from './reset-plugins/reset-plugins.handler';
import { RunPostStartHandler } from './run-post-start/run-post-start.handler';
import { RunPreStartHandler } from './run-pre-start/run-pre-start.handler';

export const COMMANDS = [ResetPluginsHandler, RunPreStartHandler, RunPostStartHandler];
