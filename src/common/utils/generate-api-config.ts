import { hasCapNetAdmin } from 'sockdestroy';

import {
    XRAY_API_INBOUND_MODEL,
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
    XRAY_ROUTING_RULES_MODEL,
    XRAY_TORRENT_BLOCKER_OUTBOUND_MODEL,
    XRAY_TORRENT_BLOCKER_ROUTING_RULES_MODEL,
} from '@libs/contracts/constants/xray';
import { XRAY_INTERNAL_FULL_WEBHOOK_PATH } from '@libs/contracts/constants';

import { getServerCerts } from './generate-mtls-certs';
import { getXtlsApiPort } from './get-initial-ports';
import { IPolicyConfig } from './interfaces';

interface IRoutingXrayConfig {
    rules: {
        ruleTag?: string;
        webhook?: {
            url: string;
            deduplication: number;
        };
        [key: string]: unknown;
    }[];
}

interface IGenerateApiConfigParams {
    config: Record<string, unknown>;
    torrentBlockerState: {
        enabled: boolean;
        includeRuleTags: Set<string>;
    };
    internal: {
        socketPath: string;
        token: string;
    };
}

export const generateApiConfig = (args: IGenerateApiConfigParams): Record<string, unknown> => {
    const { config, torrentBlockerState, internal } = args;

    const policyConfig = config.policy as undefined | IPolicyConfig;
    const serverCerts = getServerCerts();
    const hasCapNetAdminResult = hasCapNetAdmin();

    const builtPolicy: IPolicyConfig = {
        levels: {
            '0': {
                ...(policyConfig?.levels?.['0'] || {}),
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
                port: getXtlsApiPort(),
                caCertPem: serverCerts.caCertPem,
                serverCertPem: serverCerts.serverCertPem,
                serverKeyPem: serverCerts.serverKeyPem,
            }),
            ...(Array.isArray(config.inbounds) ? config.inbounds : []),
        ],
        outbounds: [...(Array.isArray(config.outbounds) ? config.outbounds : [])],
        policy: builtPolicy,
        routing: {
            ...(config.routing || {}),
            rules: [
                XRAY_ROUTING_RULES_MODEL,
                ...((config.routing as { rules?: unknown[] })?.rules || []),
            ],
        },
    };

    if (torrentBlockerState.enabled) {
        const webhookUrl = buildWebhookUrl(internal);
        const routing = result.routing as IRoutingXrayConfig;

        result.outbounds.push(XRAY_TORRENT_BLOCKER_OUTBOUND_MODEL);

        routing.rules.splice(1, 0, XRAY_TORRENT_BLOCKER_ROUTING_RULES_MODEL({ webhookUrl }));

        if (torrentBlockerState.includeRuleTags.size > 0) {
            for (const rule of routing.rules) {
                if (
                    rule.ruleTag &&
                    typeof rule.ruleTag === 'string' &&
                    torrentBlockerState.includeRuleTags.has(rule.ruleTag)
                ) {
                    rule.webhook = {
                        url: webhookUrl,
                        deduplication: 5,
                    };
                }
            }
        }
    }

    return result;
};

const buildWebhookUrl = (internal: { socketPath: string; token: string }): string => {
    return `/${internal.socketPath}:${XRAY_INTERNAL_FULL_WEBHOOK_PATH}?token=${internal.token}`;
};
