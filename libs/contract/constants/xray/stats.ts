export const XRAY_DEFAULT_POLICY_MODEL = {
    policy: {
        levels: {
            '0': {
                statsUserUplink: true,
                statsUserDownlink: true,
                statsUserOnline: false,
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
        services: ['HandlerService', 'StatsService', 'RoutingService'],
        listen: '127.0.0.1:61000',
        tag: 'REMNAWAVE_API',
    },
} as const;

export const XRAY_API_INBOUND_MODEL = {
    tag: 'api',
    port: 61000,
    listen: '127.0.0.1',
    protocol: 'dokodemo-door',
    settings: {
        address: '127.0.0.1',
    },
} as const;

export const XRAY_ROUTING_RULES_MODEL = {
    type: 'field',
    inboundTag: ['api'],
    outboundTag: 'api',
} as const;
