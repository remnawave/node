export type XrayWebhookTarget = 'torrent' | 'abuse' | 'combined';

export class XrayWebhookEvent {
    constructor(
        public readonly webhook: unknown,
        public readonly target: XrayWebhookTarget = 'torrent',
    ) {}
}
