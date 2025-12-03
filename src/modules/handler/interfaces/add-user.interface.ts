import { CipherType } from '@remnawave/xtls-sdk/build/src/xray-protos/proxy/shadowsocks/config';

export interface TAddUserRequest {
    hashData: {
        vlessUuid: string;
        prevVlessUuid?: string;
    };
    data: Array<
        | {
              cipherType: CipherType;
              ivCheck: boolean;
              password: string;
              tag: string;
              type: 'shadowsocks';
              username: string;
          }
        | {
              flow: '' | 'xtls-rprx-vision';
              tag: string;
              type: 'vless';
              username: string;
              uuid: string;
          }
        | {
              http_password: string;
              http_username: string;
              tag: string;
              type: 'http';
              username: string;
          }
        | {
              key: string;
              tag: string;
              type: 'shadowsocks2022';
              username: string;
          }
        | {
              password: string;
              tag: string;
              type: 'trojan';
              username: string;
          }
        | {
              socks_password: string;
              socks_username: string;
              tag: string;
              type: 'socks';
              username: string;
          }
    >;
}
