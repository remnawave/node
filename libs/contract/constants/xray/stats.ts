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
        tag: 'API',
    },
} as const;

export const XRAY_ROUTING_RULES_MODEL = {
    inboundTag: ['API_INBOUND'],
    outboundTag: 'API',
    type: 'field',
} as const;

export const XRAY_API_INBOUND_MODEL = {
    listen: '127.0.0.1',
    port: 61000,
    protocol: 'dokodemo-door',
    settings: {
        address: '127.0.0.1',
    },
    tag: 'API_INBOUND',
} as const;
