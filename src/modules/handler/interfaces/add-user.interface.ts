/**
 * Type of user to add - maps to sing-box inbound types
 */
export type UserType =
    | 'vless'
    | 'trojan'
    | 'shadowsocks'
    | 'shadowsocks2022'
    | 'http'
    | 'socks'
    | 'hysteria2'
    | 'shadowtls'
    | 'naive'
    | 'anytls';

/**
 * Base user request data
 */
interface IBaseUserData {
    tag: string;
    username: string;
    level?: number;
}

/**
 * VLESS user data
 */
interface IVlessUserData extends IBaseUserData {
    type: 'vless';
    uuid: string;
    flow?: '' | 'xtls-rprx-vision';
}

/**
 * Trojan user data
 */
interface ITrojanUserData extends IBaseUserData {
    type: 'trojan';
    password: string;
}

/**
 * Legacy Shadowsocks user data (pre-2022)
 */
interface IShadowsocksUserData extends IBaseUserData {
    type: 'shadowsocks';
    password: string;
    cipherType?: number;
    ivCheck?: boolean;
}

/**
 * Shadowsocks 2022 user data
 */
interface IShadowsocks2022UserData extends IBaseUserData {
    type: 'shadowsocks2022';
    key: string;
}

/**
 * HTTP proxy user data
 */
interface IHttpUserData extends IBaseUserData {
    type: 'http';
    http_username: string;
    http_password: string;
}

/**
 * SOCKS proxy user data
 */
interface ISocksUserData extends IBaseUserData {
    type: 'socks';
    socks_username: string;
    socks_password: string;
}

/**
 * Hysteria2 user data
 */
interface IHysteria2UserData extends IBaseUserData {
    type: 'hysteria2';
    password: string;
}

/**
 * ShadowTLS user data
 */
interface IShadowTLSUserData extends IBaseUserData {
    type: 'shadowtls';
    password: string;
}

/**
 * Naive user data
 */
interface INaiveUserData extends IBaseUserData {
    type: 'naive';
    password: string;
}

/**
 * AnyTLS user data
 */
interface IAnyTLSUserData extends IBaseUserData {
    type: 'anytls';
    password: string;
}

/**
 * Union type for all user data types
 */
export type TUserData =
    | IVlessUserData
    | ITrojanUserData
    | IShadowsocksUserData
    | IShadowsocks2022UserData
    | IHttpUserData
    | ISocksUserData
    | IHysteria2UserData
    | IShadowTLSUserData
    | INaiveUserData
    | IAnyTLSUserData;

/**
 * Request interface for adding a user
 */
export interface TAddUserRequest {
    hashData: {
        vlessUuid: string;
        prevVlessUuid?: string;
    };
    data: TUserData[];
}
