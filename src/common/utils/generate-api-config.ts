import {
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
    // XRAY_ROUTING_RULES_MODEL,
} from '@libs/contracts/constants/xray';

import { getXtlsApiPort } from './get-initial-ports';
import { IPolicyConfig } from './interfaces';

export const generateApiConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    // const routing = config.routing as undefined | { rules?: unknown[] };
    const policyConfig = config.policy as undefined | IPolicyConfig;

    const builtPolicy: IPolicyConfig = {
        levels: {
            '0': {
                ...(policyConfig?.levels?.['0'] || {}),
                statsUserUplink: XRAY_DEFAULT_POLICY_MODEL.policy.levels['0'].statsUserUplink,
                statsUserDownlink: XRAY_DEFAULT_POLICY_MODEL.policy.levels['0'].statsUserDownlink,
                statsUserOnline: XRAY_DEFAULT_POLICY_MODEL.policy.levels['0'].statsUserOnline,
            },
        },
        system: XRAY_DEFAULT_POLICY_MODEL.policy.system,
    };

    return {
        ...config,
        ...XRAY_DEFAULT_STATS_MODEL,
        ...XRAY_DEFAULT_API_MODEL(getXtlsApiPort()),
        policy: builtPolicy,
        // routing: {
        //     ...(routing || {}),
        //     rules: [XRAY_ROUTING_RULES_MODEL, ...(routing?.rules || [])],
        // },
        // inbounds: [
        //     XRAY_API_INBOUND_MODEL,
        //     ...(Array.isArray(config.inbounds) ? config.inbounds : []),
        // ],
    };
};
