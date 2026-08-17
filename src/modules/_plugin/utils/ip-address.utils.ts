import { isIP } from 'node:net';

export interface IParsedIpAddress {
    family: 4 | 6;
    bits: 32 | 128;
    value: bigint;
}

const parseIpv4 = (ip: string): bigint | null => {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return null;

    return octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
};

const expandIpv6Part = (part: string): string[] => {
    if (!part) return [];

    const groups = part.split(':');
    const last = groups.at(-1);
    if (!last || isIP(last) !== 4) return groups;

    const ipv4 = parseIpv4(last);
    if (ipv4 === null) return groups;

    return [
        ...groups.slice(0, -1),
        Number((ipv4 >> 16n) & 0xffffn).toString(16),
        Number(ipv4 & 0xffffn).toString(16),
    ];
};

const parseIpv6 = (input: string): bigint | null => {
    const ip = input.split('%')[0];
    const compressed = ip.split('::');
    if (compressed.length > 2) return null;

    const left = expandIpv6Part(compressed[0]);
    const right = expandIpv6Part(compressed[1] ?? '');
    const missing = 8 - left.length - right.length;
    if ((compressed.length === 1 && missing !== 0) || missing < 0) return null;

    const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
    if (groups.length !== 8) return null;

    let value = 0n;
    for (const group of groups) {
        if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
        value = (value << 16n) | BigInt(`0x${group}`);
    }

    return value;
};

export const parseIpAddress = (input: string): IParsedIpAddress | null => {
    const normalized = input.replace(/^\[|\]$/g, '').split('%')[0];
    const family = isIP(normalized);

    if (family === 4) {
        const value = parseIpv4(normalized);
        return value === null ? null : { family: 4, bits: 32, value };
    }

    if (family === 6) {
        const value = parseIpv6(normalized);
        return value === null ? null : { family: 6, bits: 128, value };
    }

    return null;
};

export const getNetworkKey = (
    ip: string,
    ipv4Prefix: number,
    ipv6Prefix: number,
): string | null => {
    const parsed = parseIpAddress(ip);
    if (!parsed) return null;

    const prefix = parsed.family === 4 ? ipv4Prefix : ipv6Prefix;
    const hostBits = BigInt(parsed.bits - prefix);
    const network = hostBits === 0n ? parsed.value : (parsed.value >> hostBits) << hostBits;

    return `${parsed.family}:${network.toString(16)}/${prefix}`;
};

interface ICidrRange extends IParsedIpAddress {
    prefix: number;
    network: bigint;
}

export class IpMatcher {
    private readonly ranges: ICidrRange[];

    constructor(values: string[]) {
        this.ranges = values.flatMap((value) => {
            const [ip, rawPrefix] = value.split('/');
            const parsed = parseIpAddress(ip);
            if (!parsed) return [];

            const prefix = rawPrefix === undefined ? parsed.bits : Number(rawPrefix);
            if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsed.bits) return [];

            const hostBits = BigInt(parsed.bits - prefix);
            const network = hostBits === 0n ? parsed.value : (parsed.value >> hostBits) << hostBits;
            return [{ ...parsed, prefix, network }];
        });
    }

    matches(ip: string): boolean {
        const parsed = parseIpAddress(ip);
        if (!parsed) return false;

        return this.ranges.some((range) => {
            if (range.family !== parsed.family) return false;
            const hostBits = BigInt(range.bits - range.prefix);
            const network = hostBits === 0n ? parsed.value : (parsed.value >> hostBits) << hostBits;
            return network === range.network;
        });
    }
}

export interface IParsedNetworkEndpoint {
    ip: string;
    port: number | null;
}

export const parseNetworkEndpoint = (input: string | null): IParsedNetworkEndpoint | null => {
    if (!input) return null;
    const value = input.replace(/^(?:tcp|udp):/i, '');

    if (value.startsWith('[')) {
        const closingBracket = value.indexOf(']');
        if (closingBracket < 0) return null;
        const ip = value.slice(1, closingBracket);
        if (!parseIpAddress(ip)) return null;
        const rawPort = value.slice(closingBracket + 1).replace(/^:/, '');
        const port = rawPort ? Number(rawPort) : null;
        return { ip, port: Number.isInteger(port) ? port : null };
    }

    if (parseIpAddress(value)) return { ip: value, port: null };

    const separator = value.lastIndexOf(':');
    if (separator < 0) return null;
    const ip = value.slice(0, separator);
    const port = Number(value.slice(separator + 1));
    if (!parseIpAddress(ip) || !Number.isInteger(port)) return null;

    return { ip, port };
};
