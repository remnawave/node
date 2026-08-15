import { hasCapNetAdmin } from 'sockdestroy';

import {
    XRAY_INTERNAL_FULL_ABUSE_WEBHOOK_PATH,
    XRAY_INTERNAL_FULL_COMBINED_WEBHOOK_PATH,
    XRAY_INTERNAL_FULL_TORRENT_WEBHOOK_PATH,
} from '@libs/contracts/constants';
import {
    XRAY_API_INBOUND_MODEL,
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
    XRAY_ROUTING_RULES_MODEL,
    XRAY_TORRENT_BLOCKER_OUTBOUND_MODEL,
    XRAY_TORRENT_BLOCKER_ROUTING_RULES_MODEL,
} from '@libs/contracts/constants/xray';
import type { AbuseBlockerCoverageMode } from '@libs/contracts/models';

import { IPolicyConfig } from './interfaces';

interface IWebhookConfig {
    url: string;
    deduplication: number;
}

interface IRoutingRule {
    ruleTag?: string;
    outboundTag?: string;
    balancerTag?: string;
    webhook?: IWebhookConfig;
    [key: string]: unknown;
}

interface IRoutingXrayConfig {
    domainStrategy?: string;
    rules: IRoutingRule[];
}

interface IGenerateApiConfigParams {
    config: Record<string, unknown>;
    torrentBlockerState: {
        enabled: boolean;
        includeRuleTags: Set<string>;
    };
    abuseBlockerState: {
        enabled: boolean;
    };
    internal: {
        socketPath: string;
        token: string;
        xtlsApiSocketPath: string;
    };
}

interface IGenerateApiConfigResult {
    config: Record<string, unknown>;
    abuseCoverage: {
        mode: AbuseBlockerCoverageMode;
        skippedWebhookRules: number;
    };
}

export const generateApiConfig = (args: IGenerateApiConfigParams): IGenerateApiConfigResult => {
    const { config, torrentBlockerState, abuseBlockerState, internal } = args;

    const policyConfig = config.policy as undefined | IPolicyConfig;
    const routingConfig = config.routing as Record<string, unknown> | undefined;
    const hasCapNetAdminResult = hasCapNetAdmin();
    const originalOutbounds = Array.isArray(config.outbounds) ? config.outbounds : [];

    const builtPolicy: IPolicyConfig = {
        levels: {
            '0': {
                ...policyConfig?.levels?.['0'],
                statsUserUplink: XRAY_DEFAULT_POLICY_MODEL.policy.levels['0'].statsUserUplink,
                statsUserDownlink: XRAY_DEFAULT_POLICY_MODEL.policy.levels['0'].statsUserDownlink,
                statsUserOnline: hasCapNetAdminResult,
            },
        },
        system: XRAY_DEFAULT_POLICY_MODEL.policy.system,
    };

    const result = {
        ...config,
        ...XRAY_DEFAULT_STATS_MODEL,
        ...XRAY_DEFAULT_API_MODEL,
        inbounds: [
            XRAY_API_INBOUND_MODEL({
                xtlsApiSocketPath: internal.xtlsApiSocketPath,
            }),
            ...(Array.isArray(config.inbounds) ? config.inbounds : []),
        ],
        outbounds: [...originalOutbounds],
        policy: builtPolicy,
        routing: {
            ...routingConfig,
            rules: [
                XRAY_ROUTING_RULES_MODEL,
                ...((config.routing as unknown as IRoutingXrayConfig)?.rules ?? []).filter(
                    (rule) => rule.outboundTag !== 'REMNAWAVE_API',
                ),
            ],
        },
    };

    const routing = result.routing as IRoutingXrayConfig;
    const abuseUrl = buildWebhookUrl(internal, XRAY_INTERNAL_FULL_ABUSE_WEBHOOK_PATH);
    const torrentUrl = buildWebhookUrl(internal, XRAY_INTERNAL_FULL_TORRENT_WEBHOOK_PATH);
    const combinedUrl = buildWebhookUrl(internal, XRAY_INTERNAL_FULL_COMBINED_WEBHOOK_PATH);
    let skippedWebhookRules = 0;
    let defaultRuleAdded = false;

    if (abuseBlockerState.enabled) {
        for (const rule of routing.rules.slice(1)) {
            if (rule.webhook) {
                skippedWebhookRules += 1;
                continue;
            }
            rule.webhook = { url: abuseUrl, deduplication: 0 };
        }

        const defaultOutbound = originalOutbounds[0] as { tag?: unknown } | undefined;
        if (typeof defaultOutbound?.tag === 'string' && defaultOutbound.tag.length > 0) {
            const defaultRule: IRoutingRule = {
                ruleTag: 'RW_ABUSE_DEFAULT',
                network: 'tcp',
                outboundTag: defaultOutbound.tag,
                webhook: { url: abuseUrl, deduplication: 0 },
            };
            if (routing.domainStrategy === 'IPIfNonMatch') {
                defaultRule.ip = ['0.0.0.0/0', '::/0'];
            }
            routing.rules.push(defaultRule);
            defaultRuleAdded = true;
        }
    }

    if (torrentBlockerState.enabled) {
        result.outbounds.push(XRAY_TORRENT_BLOCKER_OUTBOUND_MODEL);
        routing.rules.splice(
            1,
            0,
            XRAY_TORRENT_BLOCKER_ROUTING_RULES_MODEL({ webhookUrl: torrentUrl }),
        );

        if (torrentBlockerState.includeRuleTags.size > 0) {
            for (const rule of routing.rules) {
                if (
                    !rule.ruleTag ||
                    typeof rule.ruleTag !== 'string' ||
                    !torrentBlockerState.includeRuleTags.has(rule.ruleTag)
                ) {
                    continue;
                }

                if (rule.webhook?.url === abuseUrl) {
                    rule.webhook = { url: combinedUrl, deduplication: 0 };
                } else if (!rule.webhook) {
                    rule.webhook = { url: torrentUrl, deduplication: 0 };
                }
            }
        }
    }

    return {
        config: result,
        abuseCoverage: {
            mode:
                abuseBlockerState.enabled && defaultRuleAdded && skippedWebhookRules === 0
                    ? 'full'
                    : 'partial',
            skippedWebhookRules,
        },
    };
};

const buildWebhookUrl = (internal: { socketPath: string; token: string }, path: string): string =>
    `@${internal.socketPath}:${path}?token=${internal.token}`;
