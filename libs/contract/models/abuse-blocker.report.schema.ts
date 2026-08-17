import { z } from 'zod';

import { XrayWebhookSchema } from './xray-webhook.schema';

export const AbuseBlockerRuleNameSchema = z.enum(['horizontal_scan', 'destination_sweep']);
export const AbuseBlockerSeveritySchema = z.enum(['suspicious', 'alert', 'blocked']);
export const AbuseBlockerCoverageModeSchema = z.enum(['full', 'partial']);

export const AbuseBlockerPolicySchema = z.object({
    excludedPorts: z.array(z.int().min(1).max(65535)),
    scoreWindowSeconds: z.int().min(1),
    incidentCooldownSeconds: z.int().min(0),
    suspiciousScore: z.int().min(1),
    alertScore: z.int().min(1),
    blockScore: z.int().min(1),
    initialBlockSeconds: z.int().min(1),
    repeatBlockSeconds: z.int().min(1),
    repeatWindowSeconds: z.int().min(1),
    evidenceLimit: z.int().min(1),
    enhancedEvidenceLimit: z.int().min(1),
    maxTrackedUsers: z.int().min(1),
    maxKeysPerUser: z.int().min(1),
    reportBufferSize: z.int().min(1),
    horizontalScan: z.object({
        enabled: z.boolean(),
        windowSeconds: z.int().min(1),
        uniqueDestinations: z.int().min(2),
        ipv4Prefix: z.int().min(0).max(32),
        ipv6Prefix: z.int().min(0).max(128),
        score: z.int().min(1),
    }),
    destinationSweep: z.object({
        enabled: z.boolean(),
        windowSeconds: z.int().min(1),
        uniqueDestinations: z.int().min(2),
        score: z.int().min(1),
    }),
});

export const AbuseBlockerReportSchema = z.object({
    eventId: z.uuid(),
    userId: z.string().regex(/^\d+$/),
    sourceIp: z.union([z.ipv4(), z.ipv6()]),
    destinationIp: z.union([z.ipv4(), z.ipv6()]),
    destinationPort: z.int().min(1).max(65535),
    detectedAt: z.coerce.date(),
    detections: z.array(
        z.object({
            rule: AbuseBlockerRuleNameSchema,
            key: z.string(),
            uniqueDestinations: z.int().min(1),
            windowSeconds: z.int().min(1),
            score: z.int().min(1),
            subnet: z.string().nullable(),
        }),
    ),
    score: z.object({
        before: z.int().min(0),
        delta: z.int().min(1),
        after: z.int().min(1),
        windowSeconds: z.int().min(1),
    }),
    severity: AbuseBlockerSeveritySchema,
    evidence: z.array(
        z.object({
            destinationIp: z.union([z.ipv4(), z.ipv6()]),
            destinationPort: z.int().min(1).max(65535),
            lastSeenAt: z.coerce.date(),
        }),
    ),
    actionReport: z.object({
        action: z.enum(['none', 'ip_block']),
        blocked: z.boolean(),
        blockDuration: z.int().min(0),
        willUnblockAt: z.coerce.date().nullable(),
        error: z.string().nullable(),
        processedAt: z.coerce.date(),
    }),
    policy: AbuseBlockerPolicySchema,
    configFingerprint: z.string().min(1),
    coverageMode: AbuseBlockerCoverageModeSchema,
    xrayReport: XrayWebhookSchema,
});

export type AbuseBlockerRuleName = z.infer<typeof AbuseBlockerRuleNameSchema>;
export type AbuseBlockerSeverity = z.infer<typeof AbuseBlockerSeveritySchema>;
export type AbuseBlockerCoverageMode = z.infer<typeof AbuseBlockerCoverageModeSchema>;
export type AbuseBlockerPolicy = z.infer<typeof AbuseBlockerPolicySchema>;
export type AbuseBlockerReportModel = z.infer<typeof AbuseBlockerReportSchema>;
