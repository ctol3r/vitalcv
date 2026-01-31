/**
 * PSV POLICY EVALUATION TESTS
 *
 * Tests for deterministic policy evaluation logic
 */

import { describe, expect, it } from 'vitest';
import type {
  PSVCheckResult,
  PSVPolicy,
  PSVReport,
} from '../psvContracts';
import {
  PSVDecision,
  PSVSource,
  PSVStatus,
} from '../psvContracts';
import {
  createPSVReport,
  evaluatePSV,
  getMissingRequiredSources,
  getStaleChecks,
  isCheckFresh,
} from '../psvPolicy';

// Test fixtures
const BASE_POLICY: PSVPolicy = {
  policyId: 'test-policy',
  version: '1.0.0',
  name: 'Test Policy',
  freshnessRules: [
    {
      source: PSVSource.OIG_LEIE,
      maxAgeSeconds: 2592000, // 30 days
      required: true,
    },
    {
      source: PSVSource.SAM_EXCLUSIONS,
      maxAgeSeconds: 2592000, // 30 days
      required: true,
    },
    {
      source: PSVSource.STATE_BOARD,
      maxAgeSeconds: 7776000, // 90 days
      required: false,
    },
  ],
  matchingRules: [],
  blockOnAnyFail: true,
  reviewOnAnyFlag: true,
  allowUnknownSources: false,
};

function createMockCheck(
  source: PSVSource,
  status: PSVStatus,
  checkedAt: string,
  expiresAt: string | null = null
): PSVCheckResult {
  return {
    source,
    status,
    evidence: {
      source,
      checkedAt,
      expiresAt,
      queryFingerprint: `sha256:test-${source}`,
      evidenceRef: `s3://test/${source}.json`,
      rawHash: 'abc123',
    },
    normalizedFindings: status === PSVStatus.FAIL || status === PSVStatus.FLAG
      ? [
          {
            type: 'exclusion',
            severity: 'critical',
            description: 'Test exclusion',
            effectiveDate: '2024-01-01T00:00:00.000Z',
            expirationDate: null,
            details: {},
          },
        ]
      : [],
  };
}

describe('PSV Policy Evaluation', () => {
  describe('evaluatePSV()', () => {
    it('should return CLEAR when all required sources pass', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW, // Will be overwritten
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.CLEAR);
      expect(result.violations).toHaveLength(0);
      expect(result.reasons).toContain('All required sources checked and passed');
    });

    it('should return BLOCK when any check fails (blockOnAnyFail=true)', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.FAIL, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.BLOCK);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].source).toBe(PSVSource.OIG_LEIE);
      expect(result.violations[0].rule).toBe('blockOnAnyFail');
      expect(result.reasons[0]).toContain('BLOCKED');
      expect(result.reasons[0]).toContain('1 finding(s)');
    });

    it('should order BLOCK reasons by source deterministically', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.FAIL, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.FAIL, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.BLOCK);
      expect(result.reasons[0]).toContain('OIG_LEIE');
      expect(result.reasons[1]).toContain('SAM_EXCLUSIONS');
    });

    it('should return REVIEW when any check is flagged (reviewOnAnyFlag=true)', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.FLAG, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].source).toBe(PSVSource.SAM_EXCLUSIONS);
      expect(result.violations[0].rule).toBe('reviewOnAnyFlag');
      expect(result.reasons[0]).toContain('FLAGGED');
      expect(result.reasons[0]).toContain('manual review');
    });

    it('should return REVIEW when required source is missing', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          // SAM_EXCLUSIONS is missing (required)
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].source).toBe(PSVSource.SAM_EXCLUSIONS);
      expect(result.violations[0].rule).toBe('requiredSource');
      expect(result.reasons[0]).toContain('MISSING');
      expect(result.reasons[0]).toContain('SAM_EXCLUSIONS');
    });

    it('should return REVIEW when check is stale (age-based)', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const oldCheckDate = '2024-12-01T00:00:00.000Z'; // 59 days old
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, oldCheckDate), // Stale (>30 days)
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      expect(result.violations.length).toBeGreaterThan(0);
      const staleViolation = result.violations.find((v) => v.rule === 'freshness');
      expect(staleViolation).toBeDefined();
      expect(staleViolation?.source).toBe(PSVSource.OIG_LEIE);
      expect(result.reasons.some((r) => r.includes('STALE'))).toBe(true);
    });

    it('should order stale reasons by source deterministically', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2024-12-01T00:00:00.000Z'),
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2024-12-01T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      const staleReasons = result.reasons.filter((reason) => reason.startsWith('STALE'));
      expect(staleReasons).toHaveLength(2);
      expect(staleReasons[0]).toContain('OIG_LEIE');
      expect(staleReasons[1]).toContain('SAM_EXCLUSIONS');
    });

    it('should return REVIEW when check is expired (explicit expiry)', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const expiresAt = '2025-01-25T00:00:00.000Z'; // Expired 4 days ago
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z', expiresAt),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      const expiryViolation = result.violations.find((v) => v.rule === 'expiry');
      expect(expiryViolation).toBeDefined();
      expect(expiryViolation?.source).toBe(PSVSource.OIG_LEIE);
      expect(result.reasons.some((r) => r.includes('EXPIRED'))).toBe(true);
    });

    it('should return REVIEW when UNKNOWN status not allowed', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      const unknownViolation = result.violations.find((v) => v.rule === 'allowUnknownSources');
      expect(unknownViolation).toBeDefined();
      expect(unknownViolation?.source).toBe(PSVSource.SAM_EXCLUSIONS);
      expect(result.reasons.some((r) => r.includes('UNKNOWN'))).toBe(true);
    });

    it('should order UNKNOWN reasons by source deterministically', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.STATE_BOARD, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      const unknownReasons = result.reasons.filter((reason) => reason.startsWith('UNKNOWN'));
      expect(unknownReasons[0]).toContain('SAM_EXCLUSIONS');
      expect(unknownReasons[1]).toContain('STATE_BOARD');
    });

    it('should order UNKNOWN reasons for non-standard sources', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        freshnessRules: [],
      };
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck('Z_SOURCE' as PSVSource, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
          createMockCheck('A_SOURCE' as PSVSource, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, policy);
      const unknownReasons = result.reasons.filter((reason) => reason.startsWith('UNKNOWN'));

      expect(unknownReasons[0]).toContain('A_SOURCE');
      expect(unknownReasons[1]).toContain('Z_SOURCE');
    });

    it('should order known sources before unknown sources', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        freshnessRules: [],
      };
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck('Z_SOURCE' as PSVSource, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, policy);
      const unknownReasons = result.reasons.filter((reason) => reason.startsWith('UNKNOWN'));

      expect(unknownReasons[0]).toContain('OIG_LEIE');
      expect(unknownReasons[1]).toContain('Z_SOURCE');
    });

    it('should return REVIEW when ERROR status encountered', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.ERROR, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.REVIEW);
      const errorViolation = result.violations.find((v) => v.rule === 'error');
      expect(errorViolation).toBeDefined();
      expect(errorViolation?.source).toBe(PSVSource.SAM_EXCLUSIONS);
      expect(result.reasons.some((r) => r.includes('ERROR'))).toBe(true);
    });

    it('should allow FAIL when blockOnAnyFail is disabled', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        blockOnAnyFail: false,
      };
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.FAIL, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, policy);

      expect(result.decision).toBe(PSVDecision.CLEAR);
      expect(result.violations).toHaveLength(0);
    });

    it('should allow FLAG when reviewOnAnyFlag is disabled', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        reviewOnAnyFlag: false,
      };
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.FLAG, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, policy);

      expect(result.decision).toBe(PSVDecision.CLEAR);
      expect(result.violations).toHaveLength(0);
    });

    it('should ignore UNKNOWN when allowUnknownSources is enabled', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        allowUnknownSources: true,
      };
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.UNKNOWN, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, policy);

      expect(result.decision).toBe(PSVDecision.CLEAR);
      expect(result.violations).toHaveLength(0);
    });

    it('should ignore sources without freshness rules', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.DEA, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt,
        reasons: [],
      };

      const result = evaluatePSV(report, BASE_POLICY);

      expect(result.decision).toBe(PSVDecision.CLEAR);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('isCheckFresh()', () => {
    it('should return true when check is within freshness window', () => {
      const check = createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z');
      const freshnessRule = BASE_POLICY.freshnessRules[0];
      const asOf = '2025-01-29T00:00:00.000Z'; // 9 days later

      expect(isCheckFresh(check, freshnessRule, asOf)).toBe(true);
    });

    it('should return false when check exceeds max age', () => {
      const check = createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2024-12-01T00:00:00.000Z');
      const freshnessRule = BASE_POLICY.freshnessRules[0]; // 30 days max
      const asOf = '2025-01-29T00:00:00.000Z'; // 59 days later

      expect(isCheckFresh(check, freshnessRule, asOf)).toBe(false);
    });

    it('should return false when check has expired (explicit expiry)', () => {
      const expiresAt = '2025-01-25T00:00:00.000Z';
      const check = createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z', expiresAt);
      const freshnessRule = BASE_POLICY.freshnessRules[0];
      const asOf = '2025-01-29T00:00:00.000Z'; // After expiry

      expect(isCheckFresh(check, freshnessRule, asOf)).toBe(false);
    });

    it('should return true when check has no expiry and is within max age', () => {
      const check = createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z', null);
      const freshnessRule = BASE_POLICY.freshnessRules[0];
      const asOf = '2025-01-29T00:00:00.000Z';

      expect(isCheckFresh(check, freshnessRule, asOf)).toBe(true);
    });
  });

  describe('getMissingRequiredSources()', () => {
    it('should return empty array when all required sources are present', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.CLEAR,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const missing = getMissingRequiredSources(report, BASE_POLICY);

      expect(missing).toHaveLength(0);
    });

    it('should return missing required sources', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          // SAM_EXCLUSIONS is missing
        ],
        decision: PSVDecision.REVIEW,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const missing = getMissingRequiredSources(report, BASE_POLICY);

      expect(missing).toHaveLength(1);
      expect(missing[0]).toBe(PSVSource.SAM_EXCLUSIONS);
    });

    it('should not include optional sources in missing list', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          // STATE_BOARD is optional (not required)
        ],
        decision: PSVDecision.CLEAR,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const missing = getMissingRequiredSources(report, BASE_POLICY);

      expect(missing).toHaveLength(0);
    });
  });

  describe('getStaleChecks()', () => {
    it('should return empty array when all checks are fresh', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.CLEAR,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const stale = getStaleChecks(report, BASE_POLICY);

      expect(stale).toHaveLength(0);
    });

    it('should return stale checks based on age', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2024-12-01T00:00:00.000Z'), // 59 days old
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'), // 9 days old
        ],
        decision: PSVDecision.REVIEW,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const stale = getStaleChecks(report, BASE_POLICY);

      expect(stale).toHaveLength(1);
      expect(stale[0].source).toBe(PSVSource.OIG_LEIE);
    });

    it('should return checks with expired explicit expiry', () => {
      const expiresAt = '2025-01-25T00:00:00.000Z';
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-20T00:00:00.000Z', expiresAt),
          createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-20T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const stale = getStaleChecks(report, BASE_POLICY);

      expect(stale).toHaveLength(1);
      expect(stale[0].source).toBe(PSVSource.OIG_LEIE);
    });

    it('should ignore checks without freshness rules', () => {
      const report: PSVReport = {
        subjectId: 'practitioner-123',
        checks: [
          createMockCheck(PSVSource.DEA, PSVStatus.PASS, '2024-01-01T00:00:00.000Z'),
        ],
        decision: PSVDecision.REVIEW,
        decidedAt: '2025-01-29T00:00:00.000Z',
        reasons: [],
      };

      const stale = getStaleChecks(report, BASE_POLICY);

      expect(stale).toHaveLength(0);
    });
  });

  describe('createPSVReport()', () => {
    it('should default decidedAt when omitted', () => {
      const checks = [
        createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, '2025-01-28T00:00:00.000Z'),
        createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, '2025-01-28T00:00:00.000Z'),
      ];

      const report = createPSVReport('practitioner-123', checks, BASE_POLICY);

      expect(report.decidedAt).toBeTruthy();
    });
    it('should create report with CLEAR decision when all checks pass', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const oneDayAgo = '2025-01-28T00:00:00.000Z';

      const checks = [
        createMockCheck(PSVSource.OIG_LEIE, PSVStatus.PASS, oneDayAgo),
        createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, oneDayAgo),
      ];

      const report = createPSVReport('practitioner-123', checks, BASE_POLICY, decidedAt);

      expect(report.subjectId).toBe('practitioner-123');
      expect(report.checks).toHaveLength(2);
      expect(report.decision).toBe(PSVDecision.CLEAR);
      expect(report.policyVersion).toBe('1.0.0');
      expect(report.decidedAt).toBeDefined();
      expect(report.reasons).toContain('All required sources checked and passed');
    });

    it('should create report with BLOCK decision when check fails', () => {
      const decidedAt = '2025-01-29T00:00:00.000Z';
      const oneDayAgo = '2025-01-28T00:00:00.000Z';

      const checks = [
        createMockCheck(PSVSource.OIG_LEIE, PSVStatus.FAIL, oneDayAgo),
        createMockCheck(PSVSource.SAM_EXCLUSIONS, PSVStatus.PASS, oneDayAgo),
      ];

      const report = createPSVReport('practitioner-123', checks, BASE_POLICY, decidedAt);

      expect(report.decision).toBe(PSVDecision.BLOCK);
      expect(report.reasons.some((r) => r.includes('BLOCKED'))).toBe(true);
    });
  });

  describe('Matching Rules (scaffold)', () => {
    it('should validate deterministic matching configuration', () => {
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        matchingRules: [
          {
            source: PSVSource.OIG_LEIE,
            requiredFields: ['firstName', 'lastName', 'dob'],
            matchStrategy: 'exact',
          },
          {
            source: PSVSource.SAM_EXCLUSIONS,
            requiredFields: ['npi'],
            matchStrategy: 'exact',
          },
        ],
      };

      // Verify matching rules are defined
      expect(policy.matchingRules).toHaveLength(2);
      expect(policy.matchingRules[0].matchStrategy).toBe('exact');
      expect(policy.matchingRules[1].requiredFields).toContain('npi');
    });

    it('should require minConfidence for fuzzy matching', () => {
      const policy: PSVPolicy = {
        ...BASE_POLICY,
        matchingRules: [
          {
            source: PSVSource.STATE_BOARD,
            requiredFields: ['lastName', 'licenseNumber'],
            matchStrategy: 'fuzzy',
            minConfidence: 0.85,
          },
        ],
      };

      expect(policy.matchingRules[0].minConfidence).toBe(0.85);
    });
  });
});
