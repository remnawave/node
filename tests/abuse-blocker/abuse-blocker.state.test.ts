import type { XrayWebhookModel } from '../../libs/contract/models';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NodePluginSchema } from '@remnawave/node-plugins';

import { AbuseBlockerState } from '../../src/modules/_plugin/services/states/abuse-blocker.state';

const webhook: XrayWebhookModel = {
    email: '42',
    level: 0,
    protocol: null,
    network: 'tcp',
    source: '198.51.100.10:12345',
    destination: '192.0.2.1:22',
    routeTarget: null,
    originalTarget: null,
    inboundTag: 'VLESS',
    inboundName: null,
    inboundLocal: null,
    outboundTag: 'DIRECT',
    ts: 0,
};

const createState = (overrides: Record<string, unknown> = {}) => {
    const config = NodePluginSchema.parse({
        abuseBlocker: { enabled: true, ...overrides },
    }).abuseBlocker!;
    const state = new AbuseBlockerState();
    state.configure({
        config,
        configFingerprint: 'test-config',
        ignoredUsers: [],
        ignoredSources: [],
        ignoredDestinations: [],
    });
    return state;
};

const observe = (
    state: AbuseBlockerState,
    destinationIp: string,
    index: number,
    destinationPort = 22,
) =>
    state.analyze({
        userId: '42',
        sourceIp: '198.51.100.10',
        destinationIp,
        destinationPort,
        timestamp: 1_000_000 + index * 100,
        xrayReport: webhook,
    });

describe('AbuseBlockerState', () => {
    it('fires a horizontal scan once at 20 unique destinations', () => {
        const state = createState();
        for (let index = 1; index < 20; index += 1) {
            assert.equal(observe(state, `192.0.2.${index}`, index), null);
        }

        const result = observe(state, '192.0.2.20', 20);
        assert.equal(result?.scoreAfter, 100);
        assert.equal(result?.severity, 'alert');
        assert.equal(result?.detections[0].rule, 'horizontal_scan');
        assert.equal(observe(state, '192.0.2.21', 21), null);
    });

    it('counts unique destinations and ignores duplicates', () => {
        const state = createState();
        for (let index = 0; index < 100; index += 1) {
            assert.equal(observe(state, '192.0.2.1', index), null);
        }
        assert.equal(state.stats.activeIncidents, 0);
    });

    it('updates buffered alert evidence without adding score or another action', () => {
        const state = createState();
        let alert = null;
        for (let index = 1; index <= 20; index += 1) {
            alert = observe(state, `192.0.2.${index}`, index) ?? alert;
        }
        assert.ok(alert);

        state.addReport({
            eventId: '00000000-0000-4000-8000-000000000001',
            userId: '42',
            destinationPort: 22,
            score: { after: alert.scoreAfter },
            evidence: alert.evidence,
        } as Parameters<typeof state.addReport>[0]);

        assert.equal(observe(state, '192.0.2.21', 21), null);
        const [updated] = state.flushReports();
        assert.equal(updated.eventId, '00000000-0000-4000-8000-000000000001');
        assert.equal(updated.score.after, 100);
        assert.equal(updated.evidence.length, 21);
        assert.equal(updated.evidence[0].destinationIp, '192.0.2.21');
    });

    it('combines detector scores and requests a block at 150', () => {
        const state = createState();
        let lastResult = null;
        for (let index = 0; index < 50; index += 1) {
            const destination = index < 20 ? `192.0.2.${index + 1}` : `10.${index}.0.1`;
            lastResult = observe(state, destination, index) ?? lastResult;
        }

        assert.equal(lastResult?.scoreAfter, 150);
        assert.equal(lastResult?.severity, 'blocked');
        assert.equal(lastResult?.shouldBlock, true);
        assert.equal(lastResult?.detections[0].rule, 'destination_sweep');
        assert.equal(lastResult?.evidence.length, 50);
    });

    it('supports IPv6 /64 horizontal scans', () => {
        const state = createState();
        let result = null;
        for (let index = 1; index <= 20; index += 1) {
            result = observe(state, `2001:db8:abcd:12::${index.toString(16)}`, index) ?? result;
        }

        assert.equal(result?.detections[0].rule, 'horizontal_scan');
        assert.match(result?.detections[0].subnet ?? '', /^6:.*\/64$/);
    });

    it('includes the exact rolling-window boundary and expires older destinations', () => {
        const state = createState({
            horizontalScan: { uniqueDestinations: 2, windowSeconds: 60 },
            destinationSweep: { enabled: false },
        });
        const analyzeAt = (destinationIp: string, timestamp: number) =>
            state.analyze({
                userId: '42',
                sourceIp: '198.51.100.10',
                destinationIp,
                destinationPort: 22,
                timestamp,
                xrayReport: webhook,
            });

        assert.equal(analyzeAt('192.0.2.1', 1_000_000), null);
        assert.equal(analyzeAt('192.0.2.2', 1_060_000)?.severity, 'alert');

        const expired = createState({
            horizontalScan: { uniqueDestinations: 2, windowSeconds: 60 },
            destinationSweep: { enabled: false },
        });
        assert.equal(
            expired.analyze({
                userId: '42',
                sourceIp: '198.51.100.10',
                destinationIp: '192.0.2.1',
                destinationPort: 22,
                timestamp: 1_000_000,
                xrayReport: webhook,
            }),
            null,
        );
        assert.equal(
            expired.analyze({
                userId: '42',
                sourceIp: '198.51.100.10',
                destinationIp: '192.0.2.2',
                destinationPort: 22,
                timestamp: 1_060_001,
                xrayReport: webhook,
            }),
            null,
        );
    });

    it('does not combine destinations across users or ports', () => {
        const state = createState({
            horizontalScan: { uniqueDestinations: 2 },
            destinationSweep: { enabled: false },
        });
        const analyze = (userId: string, port: number, destinationIp: string, timestamp: number) =>
            state.analyze({
                userId,
                sourceIp: '198.51.100.10',
                destinationIp,
                destinationPort: port,
                timestamp,
                xrayReport: { ...webhook, email: userId },
            });

        assert.equal(analyze('42', 22, '192.0.2.1', 1_000_000), null);
        assert.equal(analyze('43', 22, '192.0.2.2', 1_000_100), null);
        assert.equal(analyze('42', 23, '192.0.2.2', 1_000_200), null);
    });

    it('re-arms a rule only after its window falls below threshold and cooldown elapses', () => {
        const state = createState({
            horizontalScan: { uniqueDestinations: 2, windowSeconds: 60 },
            destinationSweep: { enabled: false },
            incidentCooldownSeconds: 300,
        });
        const analyzeAt = (destinationIp: string, timestamp: number) =>
            state.analyze({
                userId: '42',
                sourceIp: '198.51.100.10',
                destinationIp,
                destinationPort: 22,
                timestamp,
                xrayReport: webhook,
            });

        assert.equal(analyzeAt('192.0.2.1', 1_000_000), null);
        assert.equal(analyzeAt('192.0.2.2', 1_000_100)?.scoreAfter, 100);
        assert.equal(analyzeAt('192.0.2.3', 1_061_000), null);
        assert.equal(analyzeAt('192.0.2.4', 1_301_000), null);
        assert.equal(analyzeAt('192.0.2.5', 1_301_100)?.scoreAfter, 200);
    });

    it('expires score events outside the score window', () => {
        const state = createState({
            horizontalScan: { enabled: false },
            destinationSweep: { uniqueDestinations: 2, score: 50 },
            scoreWindowSeconds: 3600,
        });
        const analyzeAt = (port: number, destinationIp: string, timestamp: number) =>
            state.analyze({
                userId: '42',
                sourceIp: '198.51.100.10',
                destinationIp,
                destinationPort: port,
                timestamp,
                xrayReport: webhook,
            });

        assert.equal(analyzeAt(22, '192.0.2.1', 1_000_000), null);
        assert.equal(analyzeAt(22, '192.0.2.2', 1_000_100)?.scoreAfter, 50);
        assert.equal(analyzeAt(23, '198.51.100.1', 4_600_101), null);
        assert.equal(analyzeAt(23, '198.51.100.2', 4_600_200)?.scoreBefore, 0);
    });

    it('respects excluded ports and source ignore ranges', () => {
        const config = NodePluginSchema.parse({ abuseBlocker: { enabled: true } }).abuseBlocker!;
        const state = new AbuseBlockerState();
        state.configure({
            config,
            configFingerprint: 'test-config',
            ignoredUsers: [],
            ignoredSources: ['198.51.100.0/24'],
            ignoredDestinations: [],
        });

        assert.equal(observe(state, '192.0.2.1', 1), null);
        assert.equal(observe(createState(), '192.0.2.1', 1, 443), null);
    });

    it('evicts the least recently used user at the configured limit', () => {
        const state = createState({ maxTrackedUsers: 1 });
        observe(state, '192.0.2.1', 1);
        state.analyze({
            userId: '43',
            sourceIp: '198.51.100.11',
            destinationIp: '192.0.2.2',
            destinationPort: 22,
            timestamp: 1_001_000,
            xrayReport: { ...webhook, email: '43' },
        });

        assert.equal(state.stats.trackedUsers, 1);
        assert.equal(state.stats.evictedUsers, 1);
    });

    it('evicts detector keys and drops the oldest buffered report at configured limits', () => {
        const state = createState({ maxKeysPerUser: 1, reportBufferSize: 1 });
        observe(state, '192.0.2.1', 1, 22);
        observe(state, '192.0.2.2', 2, 23);

        const report = {
            eventId: '00000000-0000-4000-8000-000000000001',
        } as Parameters<typeof state.addReport>[0];
        state.addReport(report);
        state.addReport({ ...report, eventId: '00000000-0000-4000-8000-000000000002' });

        assert.ok(state.stats.evictedKeys > 0);
        assert.equal(state.stats.droppedReports, 1);
        assert.deepEqual(
            state.flushReports().map((item) => item.eventId),
            ['00000000-0000-4000-8000-000000000002'],
        );
    });
});
