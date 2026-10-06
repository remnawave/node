import { TNodePlugin } from '@remnawave/node-plugins';

type TPostStartConfig = NonNullable<TNodePlugin['postStart']>;
type TPostStartWebhook = NonNullable<TPostStartConfig['webhook']>;

export class PostStartState {
    private enabled = false;
    private webhook: TPostStartWebhook = { enabled: false, url: '' };

    get isEnabled(): boolean {
        return this.enabled;
    }

    get webhookConfig(): TPostStartWebhook {
        return this.webhook;
    }

    configure(config: TPostStartConfig): void {
        this.enabled = config.enabled;

        this.webhook = config.webhook
            ? { enabled: config.webhook.enabled, url: config.webhook.url }
            : { enabled: false, url: '' };
    }

    reset(): void {
        this.enabled = false;
        this.webhook = { enabled: false, url: '' };
    }
}
