export const XRAY_DEFAULT_POLICY_MODEL = {
    policy: {
        levels: {
            '0': {
                statsUserUplink: true,
                statsUserDownlink: true,
                statsUserOnline: true,
            },
        },
        system: {
            statsInboundDownlink: true,
            statsInboundUplink: true,
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
    metrics: {
        tag: 'metrics_out',
    },
} as const;

export const XRAY_ROUTING_RULES_MODEL = {
    type: 'field',
    inboundTag: ['metrics_in'],
    outboundTag: 'metrics_out',
} as const;

export const XRAY_API_INBOUND_MODEL = {
    listen: '127.0.0.1',
    port: 11111,
    protocol: 'dokodemo-door',
    settings: {
        address: 'localhost',
    },
    tag: 'metrics_in',
} as const;
