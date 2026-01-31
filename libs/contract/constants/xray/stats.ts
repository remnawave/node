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
        tag: 'REMNAWAVE_API',
    },
} as const;

export const XRAY_API_INBOUND_MODEL = ({
    port,
    caCertPem,
    serverCertPem,
    serverKeyPem,
}: {
    port: number;
    caCertPem: string;
    serverCertPem: string;
    serverKeyPem: string;
}) =>
    ({
        tag: 'REMNAWAVE_API_INBOUND',
        port: port,
        listen: '127.0.0.1',
        protocol: 'dokodemo-door',
        settings: {
            address: '127.0.0.1',
        },
        streamSettings: {
            security: 'tls',
            tlsSettings: {
                alpn: ['h2'],
                serverName: 'internal.remnawave.local',
                disableSystemRoot: true,
                rejectUnknownSni: true,
                certificates: [
                    {
                        certificate: serverCertPem
                            .replace(/\r\n/g, '\n')
                            .split('\n')
                            .filter((line: string) => line),
                        key: serverKeyPem
                            .replace(/\r\n/g, '\n')
                            .split('\n')
                            .filter((line: string) => line),
                    },
                    {
                        usage: 'verify',
                        certificate: caCertPem
                            .replace(/\r\n/g, '\n')
                            .split('\n')
                            .filter((line: string) => line),
                    },
                ],
            },
        },
    }) as const;

export const XRAY_ROUTING_RULES_MODEL = {
    inboundTag: ['REMNAWAVE_API_INBOUND'],
    outboundTag: 'REMNAWAVE_API',
} as const;
