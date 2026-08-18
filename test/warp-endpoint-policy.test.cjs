const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

let endpointPolicy;

try {
    endpointPolicy = require('../src/modules/warp/warp-endpoint-policy.ts');
} catch (error) {
    assert.fail(`WARP endpoint policy is not implemented: ${error.message}`);
}

const { getWarpEndpointCandidates, hasDualStackWarpTrace } = endpointPolicy;
const { WarpService } = require('../src/modules/warp/warp.service.ts');

const createServiceHarness = (tracesByEndpoint) => {
    const service = new WarpService();
    const attemptedEndpoints = [];
    const persistedEndpoints = [];
    let activeEndpoint = null;

    service.getConfiguredWarpEndpoint = () => '162.159.192.1:2408';
    service.appendOperationLog = () => {};
    service.execFixed = async (_command, args) => {
        if (args[0] === 'show') {
            return { stdout: 'public-peer-key\n', stderr: '' };
        }

        activeEndpoint = args.at(-1);
        attemptedEndpoints.push(activeEndpoint);
        return { stdout: '', stderr: '' };
    };
    service.getTrace = async (ipVersion) => tracesByEndpoint[activeEndpoint]?.[ipVersion] ?? null;
    service.persistWarpEndpoint = (endpoint) => persistedEndpoints.push(endpoint);

    return { attemptedEndpoints, persistedEndpoints, service };
};

describe('WARP endpoint policy', () => {
    it('keeps a supported configured endpoint first and falls back to alternate UDP ports', () => {
        assert.deepEqual(getWarpEndpointCandidates('162.159.192.1:500'), [
            '162.159.192.1:500',
            '162.159.192.1:2408',
            '162.159.192.1:1701',
            '162.159.192.1:4500',
        ]);
    });

    it('uses the default candidate order for an unsupported endpoint', () => {
        assert.deepEqual(getWarpEndpointCandidates('engage.cloudflareclient.com:2408'), [
            '162.159.192.1:2408',
            '162.159.192.1:500',
            '162.159.192.1:1701',
            '162.159.192.1:4500',
        ]);
    });

    it('accepts an endpoint only when both WARP traces are on', () => {
        assert.equal(hasDualStackWarpTrace({ warp: 'on' }, { warp: 'on' }), true);
        assert.equal(hasDualStackWarpTrace({ warp: 'on' }, null), false);
        assert.equal(hasDualStackWarpTrace({ warp: 'on' }, { warp: 'off' }), false);
    });

    it('retries a failed default endpoint and persists the first dual-stack endpoint', async () => {
        const harness = createServiceHarness({
            '162.159.192.1:2408': { 4: { warp: 'on' }, 6: null },
            '162.159.192.1:500': { 4: { warp: 'on' }, 6: { warp: 'on' } },
        });

        await harness.service.ensureReachableWarpEndpoint();

        assert.deepEqual(harness.attemptedEndpoints, ['162.159.192.1:2408', '162.159.192.1:500']);
        assert.deepEqual(harness.persistedEndpoints, ['162.159.192.1:500']);
    });

    it('does not persist an endpoint when every candidate fails dual-stack verification', async () => {
        const harness = createServiceHarness(
            Object.fromEntries(
                getWarpEndpointCandidates(null).map((endpoint) => [
                    endpoint,
                    { 4: { warp: 'on' }, 6: { warp: 'off' } },
                ]),
            ),
        );

        await assert.rejects(
            harness.service.ensureReachableWarpEndpoint(),
            /No WARP endpoint provided working IPv4 and IPv6 traces/,
        );

        assert.deepEqual(harness.attemptedEndpoints, getWarpEndpointCandidates(null));
        assert.deepEqual(harness.persistedEndpoints, []);
    });
});
