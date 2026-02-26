import { DropConnectionsHandler } from './drop-connections';
import { XrayWebhookHandler } from './xray-webhook';

export const EVENTS = [XrayWebhookHandler, DropConnectionsHandler];
