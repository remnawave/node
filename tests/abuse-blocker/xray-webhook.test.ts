import type { XrayWebhookModel } from '../../libs/contract/models';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toAbuseBlockerObservation } from '../../src/modules/_plugin/events/xray-webhook/xray-webhook.handler';

const webhook: XrayWebhookModel = {
    email: '42',
    level: 0,
    protocol: null,
    network: 'tcp',
    source: 'tcp:198.51.100.10:12345',
    destination: '203.0.113.10:22',
    routeTarget: '192.0.2.10:3389',
    originalTarget: '10.0.0.10:445',
    inboundTag: 'VLESS',
    inboundName: null,
    inboundLocal: null,
    outboundTag: 'DIRECT',
    ts: 123,
};

describe('abuse blocker Xray observations', () => {
    it('prefers originalTarget and converts Xray seconds to milliseconds', () => {
        const observation = toAbuseBlockerObservation(webhook);

        assert.equal(observation?.destinationIp, '10.0.0.10');
        assert.equal(observation?.destinationPort, 445);
        assert.equal(observation?.timestamp, 123_000);
    });

    it('falls back through routeTarget to destination', () => {
        assert.equal(
            toAbuseBlockerObservation({ ...webhook, originalTarget: 'example.com:443' })
                ?.destinationIp,
            '192.0.2.10',
        );
        assert.equal(
            toAbuseBlockerObservation({
                ...webhook,
                originalTarget: null,
                routeTarget: null,
            })?.destinationIp,
            '203.0.113.10',
        );
    });

    it('ignores UDP, non-numeric users, and domain-only destinations', () => {
        assert.equal(toAbuseBlockerObservation({ ...webhook, network: 'udp' }), null);
        assert.equal(toAbuseBlockerObservation({ ...webhook, email: 'user@example.com' }), null);
        assert.equal(
            toAbuseBlockerObservation({
                ...webhook,
                originalTarget: 'example.com:22',
                routeTarget: 'example.net:22',
                destination: 'example.org:22',
            }),
            null,
        );
    });
});
