import { CipherType } from '@remnawave/xtls-sdk/build/src/xray-protos/proxy/shadowsocks/config';

export interface TAddUserRequest {
    data: Array<
        | {
              cipherType: CipherType;
              ivCheck: boolean;
              level: number;
              password: string;
              tag: string;
              type: 'shadowsocks';
              username: string;
          }
        | {
              flow: '' | 'xtls-rprx-vision';
              level: number;
              tag: string;
              type: 'vless';
              username: string;
              uuid: string;
          }
        | {
              http_password: string;
              http_username: string;
              level: number;
              tag: string;
              type: 'http';
              username: string;
          }
        | {
              key: string;
              level: number;
              tag: string;
              type: 'shadowsocks2022';
              username: string;
          }
        | {
              level: number;
              password: string;
              tag: string;
              type: 'trojan';
              username: string;
          }
        | {
              level: number;
              socks_password: string;
              socks_username: string;
              tag: string;
              type: 'socks';
              username: string;
          }
    >;
}
