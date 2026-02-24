import { hasCapNetAdmin } from 'sockdestroy';

import {
    XRAY_API_INBOUND_MODEL,
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
    XRAY_ROUTING_RULES_MODEL,
} from '@libs/contracts/constants/xray';

import { getServerCerts } from './generate-mtls-certs';
import { getXtlsApiPort } from './get-initial-ports';
import { IPolicyConfig } from './interfaces';

export const generateApiConfig = (config: Record<string, unknown>): Record<string, unknown> => {
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
        policy: builtPolicy,
        routing: {
            ...(config.routing || {}),
            rules: [
                XRAY_ROUTING_RULES_MODEL,
                ...((config.routing as { rules?: unknown[] })?.rules || []),
            ],
        },
    };
};
