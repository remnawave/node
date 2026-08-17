import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    getNetworkKey,
    IpMatcher,
    parseNetworkEndpoint,
} from '../../src/modules/_plugin/utils/ip-address.utils';

describe('IP utilities', () => {
    it('groups IPv4 and IPv6 destinations by configured prefixes', () => {
        assert.equal(getNetworkKey('192.0.2.42', 24, 64), '4:c0000200/24');
        assert.equal(
            getNetworkKey('2001:db8:abcd:12::1', 24, 64),
            '6:20010db8abcd00120000000000000000/64',
        );
    });

    it('matches exact addresses and CIDR ranges', () => {
        const matcher = new IpMatcher(['192.0.2.0/24', '2001:db8::/32', '203.0.113.1']);
        assert.equal(matcher.matches('192.0.2.99'), true);
        assert.equal(matcher.matches('2001:db8:1::1'), true);
        assert.equal(matcher.matches('203.0.113.1'), true);
        assert.equal(matcher.matches('198.51.100.1'), false);
    });

    it('parses Xray IPv4 and bracketed IPv6 endpoints', () => {
        assert.deepEqual(parseNetworkEndpoint('tcp:192.0.2.1:22'), {
            ip: '192.0.2.1',
            port: 22,
        });
        assert.deepEqual(parseNetworkEndpoint('[2001:db8::1]:3389'), {
            ip: '2001:db8::1',
            port: 3389,
        });
        assert.equal(parseNetworkEndpoint('example.com:22'), null);
    });
});
