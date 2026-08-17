import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NFT_TABLES_CONSTANTS } from '../../src/modules/_plugin/constants/nfttables.contants';
import { NftService } from '../../src/modules/_plugin/services/nft.service';

interface INftCall {
    operation: 'add' | 'remove';
    ip: string;
    set: string;
    timeout?: number;
}

const createService = () => {
    const calls: INftCall[] = [];
    const dropped: string[][] = [];
    const manager = {
        addAddress: async ({ ip, set, timeout }: { ip: string; set: string; timeout: number }) => {
            calls.push({ operation: 'add', ip, set, timeout });
        },
        removeAddresses: async ({ ips, set }: { ips: string[]; set: string }) => {
            calls.push({ operation: 'remove', ip: ips[0], set });
        },
    };
    const service = new NftService(
        { plugins: {}, setPlugins: () => void 0 } as never,
        { publish: (event: { ips: string[] }) => dropped.push(event.ips) } as never,
    );
    Object.assign(service, { nftManager: manager });
    return { calls, dropped, service };
};

describe('NftService abuse blocker', () => {
    it('uses the dedicated timeout set for IPv4 and IPv6 and drops active connections', async () => {
        const { calls, dropped, service } = createService();

        await service.blockAbuseIp('198.51.100.10', 600);
        await service.blockAbuseIp('2001:db8::10', 3600);

        assert.deepEqual(calls, [
            {
                operation: 'add',
                ip: '198.51.100.10',
                set: NFT_TABLES_CONSTANTS.ABUSE_BLOCKER_SET_NAME,
                timeout: 600,
            },
            {
                operation: 'add',
                ip: '2001:db8::10',
                set: NFT_TABLES_CONSTANTS.ABUSE_BLOCKER_SET_NAME,
                timeout: 3600,
            },
        ]);
        assert.deepEqual(dropped, [['198.51.100.10'], ['2001:db8::10']]);
    });

    it('refreshes a block with a serialized remove then add', async () => {
        const { calls, service } = createService();

        await Promise.all([
            service.refreshAbuseIp('198.51.100.10', 3600),
            service.refreshAbuseIp('198.51.100.11', 3600),
        ]);

        assert.deepEqual(
            calls.map((call) => `${call.operation}:${call.ip}`),
            [
                'remove:198.51.100.10',
                'add:198.51.100.10',
                'remove:198.51.100.11',
                'add:198.51.100.11',
            ],
        );
    });
});
