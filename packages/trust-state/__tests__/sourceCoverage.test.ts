import { describe, expect, it } from 'vitest';
import {
  createCanonicalTruth,
  createCanonicalSourceCoverage,
  findPriorityCanonicalSourceCoverage,
  mapSourceCoverageStateToTrustStatus,
  normalizeCanonicalSourceCoverageState,
  sourceCoveragePosture,
  summarizeCanonicalSourceCoverage,
} from '../sourceCoverage';

describe('Canonical Source Coverage Contracts', () => {
  it('serializes coverage immutably without trailing whitespace or empty arrays', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: '  OIG_LEIE  ',
      state: 'checked',
      reason: '  checked  ',
      checkedAt: '2026-03-23T12:00:00Z',
      observedAt: '2026-03-23T11:45:00Z',
      artifactId: '  art-123  ',
      sourceUrl: ' https://oig.hhs.gov/exclusions/ ',
      rawArtifactRef: ' raw://oig/art-123 ',
      checksum: ' checksum-123 ',
      parserVersion: ' v1.2.0 ',
      freshnessWindowHours: 24,
      proof: {
        artifactIds: [' art-123 '],
        receiptIds: [' receipt-123 '],
      },
    });

    expect(coverage.sourceId).toBe('OIG_LEIE');
    expect(coverage.reason).toBe('checked');
    expect(coverage.artifactId).toBe('art-123');
    expect(coverage.observedAt).toBe('2026-03-23T11:45:00Z');
    expect(coverage.proof).toEqual({
      artifactIds: ['art-123'],
      receiptIds: ['receipt-123'],
    });
    expect(coverage.freshness).toEqual({
      status: 'current',
      checkedAt: '2026-03-23T12:00:00Z',
      observedAt: '2026-03-23T11:45:00Z',
      expiresAt: '2026-03-24T11:45:00.000Z',
      freshnessWindowHours: 24,
    });
    expect(coverage.provenance).toEqual({
      artifactId: 'art-123',
      artifactIds: ['art-123'],
      receiptIds: ['receipt-123'],
      sourceUrl: 'https://oig.hhs.gov/exclusions/',
      rawArtifactRef: 'raw://oig/art-123',
      checksum: 'checksum-123',
      parserVersion: 'v1.2.0',
    });
    expect(Object.isFrozen(coverage)).toBe(true);
    expect(Object.isFrozen(coverage.proof)).toBe(true);
    expect(Object.isFrozen(coverage.freshness)).toBe(true);
    expect(Object.isFrozen(coverage.provenance)).toBe(true);
  });

  it('omits proof entirely if both artifactIds and receiptIds are empty', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'notDecisionGrade',
      reason: 'unsupported source',
      proof: {
        artifactIds: [],
        receiptIds: [],
      },
    });

    expect(coverage).not.toHaveProperty('proof');
  });

  it('summarizes canonically across all exact statuses', () => {
    const checks = [
      createCanonicalSourceCoverage({ sourceId: 'A', state: 'checked', reason: 'A' }),
      createCanonicalSourceCoverage({ sourceId: 'B', state: 'checked', reason: 'B' }),
      createCanonicalSourceCoverage({ sourceId: 'C', state: 'stale', reason: 'C' }),
      createCanonicalSourceCoverage({ sourceId: 'D', state: 'notDecisionGrade', reason: 'D' }),
      createCanonicalSourceCoverage({ sourceId: 'E', state: 'accessRequired', reason: 'E' }),
      createCanonicalSourceCoverage({ sourceId: 'F', state: 'previewOnly', reason: 'F' }),
    ];

    const summary = summarizeCanonicalSourceCoverage(checks);

    expect(summary.checked).toEqual(['A', 'B']);
    expect(summary.stale).toEqual(['C']);
    expect(summary.notDecisionGrade).toEqual(['D']);
    expect(summary.accessRequired).toEqual(['E']);
    expect(summary.previewOnly).toEqual(['F']);
    expect(summary.unavailable).toEqual([]);
    expect(Object.isFrozen(summary)).toBe(true);
  });

  it('normalizes shared source coverage aliases for web and backend callers', () => {
    expect(normalizeCanonicalSourceCoverageState('CHECKED')).toBe('checked');
    expect(normalizeCanonicalSourceCoverageState('live')).toBe('checked');
    expect(normalizeCanonicalSourceCoverageState('access-required')).toBe('accessRequired');
    expect(normalizeCanonicalSourceCoverageState('HUMAN_REQUIRED')).toBe('reviewRequired');
    expect(normalizeCanonicalSourceCoverageState('not_checked')).toBe('pending');
    expect(normalizeCanonicalSourceCoverageState('demo')).toBe('previewOnly');
    expect(normalizeCanonicalSourceCoverageState('bogus')).toBeNull();
  });

  it('keeps degraded and pending states distinct in the shared source contract', () => {
    expect(sourceCoveragePosture('stale')).toBe('degraded');
    expect(sourceCoveragePosture('notDecisionGrade')).toBe('partial');
    expect(mapSourceCoverageStateToTrustStatus('stale')).toBe('stale');
    expect(mapSourceCoverageStateToTrustStatus('notDecisionGrade')).toBe('pending');
  });

  it('finds the highest-priority downgrade reason without manual string branching', () => {
    const checks = [
      createCanonicalSourceCoverage({ sourceId: 'STATE_BOARD', state: 'pending', reason: 'not checked' }),
      createCanonicalSourceCoverage({ sourceId: 'PECOS_PUBLIC', state: 'stale', reason: 'stale quarterly file' }),
      createCanonicalSourceCoverage({ sourceId: 'NURSYS', state: 'gated', reason: 'institutional access required' }),
    ];

    expect(findPriorityCanonicalSourceCoverage(checks, ['reviewRequired', 'stale', 'gated'])?.reason).toBe(
      'stale quarterly file',
    );
  });

  it('normalizes explicit truth status rules from canonical source coverage', () => {
    const checkedCoverage = createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'checked',
      reason: 'clear check',
    });
    const reviewCoverage = createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'reviewRequired',
      reason: 'manual adjudication required',
    });
    const previewCoverage = createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'previewOnly',
      reason: 'demo payload',
    });

    expect(createCanonicalTruth({
      kind: 'clearance',
      satisfied: true,
      coverage: checkedCoverage,
    })).toMatchObject({ status: 'CLEAR', decisionGrade: true });
    expect(createCanonicalTruth({
      kind: 'verification',
      satisfied: false,
      coverage: checkedCoverage,
    })).toMatchObject({ status: 'PENDING', decisionGrade: true });
    expect(createCanonicalTruth({
      kind: 'verification',
      satisfied: true,
      coverage: reviewCoverage,
    })).toMatchObject({ status: 'REVIEW REQUIRED', decisionGrade: false });
    expect(createCanonicalTruth({
      kind: 'enrollment',
      satisfied: true,
      coverage: previewCoverage,
    })).toMatchObject({ status: 'NOT DECISION-GRADE', decisionGrade: false });
  });
});
