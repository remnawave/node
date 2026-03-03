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

export const generateApiConfig = (
    config: Record<string, unknown>,
    isTorrentBlockerEnabled: boolean,
    internal: {
        socketPath: string;
        token: string;
    },
): Record<string, unknown> => {
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

    return {
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
        outbounds: [
            ...(Array.isArray(config.outbounds) ? config.outbounds : []),
            ...(isTorrentBlockerEnabled ? [XRAY_TORRENT_BLOCKER_OUTBOUND_MODEL] : []),
        ],
        policy: builtPolicy,
        routing: {
            ...(config.routing || {}),
            rules: [
                XRAY_ROUTING_RULES_MODEL,
                ...(isTorrentBlockerEnabled
                    ? [
                          XRAY_TORRENT_BLOCKER_ROUTING_RULES_MODEL({
                              webhookUrl: `/${internal.socketPath}:${XRAY_INTERNAL_FULL_WEBHOOK_PATH}?token=${internal.token}`,
                          }),
                      ]
                    : []),
                ...((config.routing as { rules?: unknown[] })?.rules || []),
            ],
        },
    };
};
