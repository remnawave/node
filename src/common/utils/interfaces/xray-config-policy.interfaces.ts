export interface IPolicyLevel {
    handshake?: number;
    connIdle?: number;
    uplinkOnly?: number;
    downlinkOnly?: number;
    bufferSize?: number;
    statsUserUplink?: boolean;
    statsUserDownlink?: boolean;
    statsUserOnline?: boolean;
}

export interface IPolicySystem {
    statsInboundUplink?: boolean;
    statsInboundDownlink?: boolean;
    statsOutboundUplink?: boolean;
    statsOutboundDownlink?: boolean;
}

export interface IPolicyConfig {
    levels?: Record<string, IPolicyLevel>;
    system?: IPolicySystem;
}
