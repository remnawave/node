import {
    XRAY_DEFAULT_API_MODEL,
    XRAY_DEFAULT_POLICY_MODEL,
    XRAY_DEFAULT_STATS_MODEL,
} from '@libs/contracts/constants/xray';

export const generateApiConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    return {
        ...config,
        ...XRAY_DEFAULT_STATS_MODEL,
        ...XRAY_DEFAULT_POLICY_MODEL,
        ...XRAY_DEFAULT_API_MODEL,
    };
};
