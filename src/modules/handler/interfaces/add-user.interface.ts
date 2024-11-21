import { CipherType } from '@remnawave/xtls-sdk/build/src/xray-protos/proxy/shadowsocks/config';

export interface TAddUserRequest {
    data: Array<
        | {
              type: 'trojan';
              tag: string;
              username: string;
              password: string;
              level: number;
          }
        | {
              type: 'vless';
              tag: string;
              username: string;
              uuid: string;
              flow: 'xtls-rprx-vision' | '';
              level: number;
          }
        | {
              type: 'shadowsocks';
              tag: string;
              username: string;
              password: string;
              cipherType: CipherType;
              ivCheck: boolean;
              level: number;
          }
        | {
              type: 'shadowsocks2022';
              tag: string;
              username: string;
              key: string;
              level: number;
          }
        | {
              type: 'socks';
              tag: string;
              username: string;
              socks_username: string;
              socks_password: string;
              level: number;
          }
        | {
              type: 'http';
              tag: string;
              username: string;
              http_username: string;
              http_password: string;
              level: number;
          }
    >;
}
