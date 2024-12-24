export const XRAY_DEFAULT_POLICY_MODEL = {
    policy: {
        levels: {
            '0': {
                statsUserUplink: true,
                statsUserDownlink: true,
            },
        },
        system: {
            statsInboundDownlink: false,
            statsInboundUplink: false,
            statsOutboundDownlink: true,
            statsOutboundUplink: true,
        },
    },
} as const;

export const XRAY_DEFAULT_STATS_MODEL = {
    stats: {},
} as const;

export const XRAY_DEFAULT_API_MODEL = {
    api: {
        services: ['HandlerService', 'StatsService', 'LoggerService'],
        listen: '127.0.0.1:61000',
        tag: 'API',
    },
} as const;
