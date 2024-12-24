import {
    XRAY_API_INBOUND_MODEL,
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
    XRAY_ROUTING_RULES_MODEL,
} from '@libs/contracts/constants/xray';

export const generateApiConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const routing = config.routing as undefined | { rules?: unknown[] };

    return {
        ...config,
        ...XRAY_DEFAULT_STATS_MODEL,
        ...XRAY_DEFAULT_POLICY_MODEL,
        ...XRAY_DEFAULT_API_MODEL,
        routing: {
            ...(routing || {}),
            rules: [XRAY_ROUTING_RULES_MODEL, ...(routing?.rules || [])],
        },
        inbounds: [
            XRAY_API_INBOUND_MODEL,
            ...(Array.isArray(config.inbounds) ? config.inbounds : []),
        ],
    };
};
