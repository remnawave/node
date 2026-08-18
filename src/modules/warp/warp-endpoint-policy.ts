export const WARP_ENDPOINT_CANDIDATES = [
    '162.159.192.1:2408',
    '162.159.192.1:500',
    '162.159.192.1:1701',
    '162.159.192.1:4500',
] as const;

type TWarpTraceState = null | { warp: string };

export function getWarpEndpointCandidates(configuredEndpoint: string | null): string[] {
    if (
        !configuredEndpoint ||
        !WARP_ENDPOINT_CANDIDATES.some((endpoint) => endpoint === configuredEndpoint)
    ) {
        return [...WARP_ENDPOINT_CANDIDATES];
    }

    return [
        configuredEndpoint,
        ...WARP_ENDPOINT_CANDIDATES.filter((endpoint) => endpoint !== configuredEndpoint),
    ];
}

export function hasDualStackWarpTrace(ipv4: TWarpTraceState, ipv6: TWarpTraceState): boolean {
    return ipv4?.warp === 'on' && ipv6?.warp === 'on';
}
