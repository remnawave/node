import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateApiConfig } from '../../src/common/utils/generate-api-config';

const internal = {
    socketPath: 'rw-internal.sock',
    token: 'test-token',
    xtlsApiSocketPath: 'rw-xray.sock',
};

const generate = (config: Record<string, unknown>, torrentTags = new Set<string>()) =>
    generateApiConfig({
        config,
        abuseBlockerState: { enabled: true },
        torrentBlockerState: { enabled: torrentTags.size > 0, includeRuleTags: torrentTags },
        internal,
    });

describe('generateApiConfig abuse routing', () => {
    it('instruments explicit rules and an AsIs default route', () => {
        const generated = generate({
            outbounds: [{ tag: 'DIRECT', protocol: 'freedom' }],
            routing: {
                rules: [{ ruleTag: 'PRIVATE', ip: ['geoip:private'], outboundTag: 'BLOCK' }],
            },
        });
        const rules = (generated.config.routing as { rules: Record<string, unknown>[] }).rules;

        assert.equal(generated.abuseCoverage.mode, 'full');
        assert.equal((rules[1].webhook as { deduplication: number }).deduplication, 0);
        assert.equal(rules.at(-1)?.ruleTag, 'RW_ABUSE_DEFAULT');
        assert.equal(rules.at(-1)?.network, 'tcp');
    });

    it('uses an IP catch-all for IPIfNonMatch', () => {
        const generated = generate({
            outbounds: [{ tag: 'DIRECT', protocol: 'freedom' }],
            routing: { domainStrategy: 'IPIfNonMatch', rules: [] },
        });
        const rules = (generated.config.routing as { rules: Record<string, unknown>[] }).rules;
        assert.deepEqual(rules.at(-1)?.ip, ['0.0.0.0/0', '::/0']);
    });

    it('preserves external webhooks and reports partial coverage', () => {
        const external = { url: 'https://example.com/hook', deduplication: 10 };
        const generated = generate({
            outbounds: [{ tag: 'DIRECT', protocol: 'freedom' }],
            routing: {
                rules: [{ ruleTag: 'EXTERNAL', outboundTag: 'DIRECT', webhook: external }],
            },
        });
        const rules = (generated.config.routing as { rules: Record<string, unknown>[] }).rules;

        assert.deepEqual(rules[1].webhook, external);
        assert.equal(generated.abuseCoverage.mode, 'partial');
        assert.equal(generated.abuseCoverage.skippedWebhookRules, 1);
    });

    it('does not replace an external webhook selected by torrentBlocker', () => {
        const external = { url: 'https://example.com/hook', deduplication: 10 };
        const generated = generate(
            {
                outbounds: [{ tag: 'DIRECT', protocol: 'freedom' }],
                routing: {
                    rules: [
                        {
                            ruleTag: 'EXTERNAL',
                            outboundTag: 'DIRECT',
                            webhook: external,
                        },
                    ],
                },
            },
            new Set(['EXTERNAL']),
        );
        const rules = (generated.config.routing as { rules: Record<string, unknown>[] }).rules;
        const externalRule = rules.find((rule) => rule.ruleTag === 'EXTERNAL');

        assert.ok(externalRule);
        assert.deepEqual(externalRule.webhook, external);
    });

    it('uses the combined endpoint when torrentBlocker observes the same rule', () => {
        const generated = generate(
            {
                outbounds: [{ tag: 'DIRECT', protocol: 'freedom' }],
                routing: {
                    rules: [{ ruleTag: 'WATCHED', outboundTag: 'DIRECT' }],
                },
            },
            new Set(['WATCHED']),
        );
        const rules = (generated.config.routing as { rules: Record<string, unknown>[] }).rules;
        const watched = rules.find((rule) => rule.ruleTag === 'WATCHED');

        assert.ok(watched);
        assert.match((watched.webhook as { url: string }).url, /\/internal\/webhook\/combined/);
        assert.equal((watched.webhook as { deduplication: number }).deduplication, 0);

        const torrentRule = rules.find((rule) => rule.outboundTag === 'RW_TB_OUTBOUND_BLOCK');
        assert.ok(torrentRule);
        assert.equal((torrentRule.webhook as { deduplication: number }).deduplication, 0);
    });
});
