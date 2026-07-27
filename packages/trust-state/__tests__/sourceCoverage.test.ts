import { describe, expect, it } from 'vitest';
import {
  assertNonGatedIfPositive,
  CANONICAL_TRUTH_STATUSES,
  createCanonicalTruth,
  createCanonicalSourceCoverage,
  findPriorityCanonicalSourceCoverage,
  isGatedTruthStatus,
  isReadinessPositive,
  mapSourceCoverageStateToTrustStatus,
  normalizeCanonicalSourceCoverageState,
  resolveCanonicalTruthStatus,
  sourceCoverageBadgeLabel,
  sourceCoveragePosture,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverageState,
  type CanonicalTruthKind,
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

  it('normalizes unsupported source states into notDecisionGrade without pretending they are current', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: 'UNSUPPORTED_SOURCE',
      state: 'unsupported',
      reason: 'unsupported source',
      checkedAt: '2026-03-23T12:00:00.000Z',
      freshnessWindowHours: 24,
    });

    expect(coverage.state).toBe('notDecisionGrade');
    expect(coverage.freshness).toEqual({
      status: 'unknown',
      checkedAt: '2026-03-23T12:00:00.000Z',
      observedAt: '2026-03-23T12:00:00.000Z',
      expiresAt: '2026-03-24T12:00:00.000Z',
      freshnessWindowHours: 24,
    });
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
    expect(sourceCoverageBadgeLabel({ state: 'checked', decisionGrade: true })).toBe('Source-backed');
    expect(sourceCoverageBadgeLabel({ state: 'checked', decisionGrade: false })).toBe('Checked');
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
    })).toMatchObject({ status: 'REVIEW_REQUIRED', decisionGrade: false });
    expect(createCanonicalTruth({
      kind: 'enrollment',
      satisfied: true,
      coverage: previewCoverage,
    })).toMatchObject({ status: 'NOT_DECISION_GRADE', decisionGrade: false });
  });
});

describe('Wave 2 — Canonical Trust Parity', () => {
  describe('8-status contract exhaustiveness', () => {
    it('defines exactly 8 canonical truth statuses with underscored identifiers', () => {
      expect(CANONICAL_TRUTH_STATUSES).toHaveLength(8);
      expect(CANONICAL_TRUTH_STATUSES).toEqual([
        'VERIFIED',
        'CLEAR',
        'ENROLLED',
        'PENDING',
        'REVIEW_REQUIRED',
        'UNAVAILABLE',
        'ACCESS_REQUIRED',
        'NOT_DECISION_GRADE',
      ]);
      for (const status of CANONICAL_TRUTH_STATUSES) {
        expect(status).not.toContain(' ');
        expect(status).not.toContain('-');
      }
    });
  });

  describe('gated source guard — ACCESS_REQUIRED / NOT_DECISION_GRADE never appear as positive', () => {
    const gatedCoverageStates: CanonicalSourceCoverageState[] = [
      'gated',
      'accessRequired',
      'notDecisionGrade',
      'previewOnly',
    ];
    const positiveStatuses = ['VERIFIED', 'CLEAR', 'ENROLLED'] as const;

    for (const coverageState of gatedCoverageStates) {
      for (const positiveStatus of positiveStatuses) {
        it(`throws if ${positiveStatus} is assigned to coverage state '${coverageState}'`, () => {
          expect(() =>
            assertNonGatedIfPositive(positiveStatus, coverageState),
          ).toThrow(/Trust parity violation/);
        });
      }
    }

    it('allows VERIFIED for checked coverage', () => {
      expect(() => assertNonGatedIfPositive('VERIFIED', 'checked')).not.toThrow();
    });

    it('allows PENDING for any coverage state', () => {
      for (const state of gatedCoverageStates) {
        expect(() => assertNonGatedIfPositive('PENDING', state)).not.toThrow();
      }
    });
  });

  describe('readiness guard — gated sources never contribute positively', () => {
    it('ACCESS_REQUIRED truth does not contribute to readiness', () => {
      const truth = createCanonicalTruth({
        kind: 'verification',
        satisfied: false,
        coverage: createCanonicalSourceCoverage({
          sourceId: 'STATE_BOARD',
          state: 'accessRequired',
          reason: 'institutional access required',
        }),
      });
      expect(truth.status).toBe('ACCESS_REQUIRED');
      expect(isReadinessPositive(truth)).toBe(false);
    });

    it('NOT_DECISION_GRADE truth does not contribute to readiness', () => {
      const truth = createCanonicalTruth({
        kind: 'enrollment',
        satisfied: true,
        coverage: createCanonicalSourceCoverage({
          sourceId: 'PECOS_PUBLIC',
          state: 'notDecisionGrade',
          reason: 'quarterly snapshot',
        }),
      });
      expect(truth.status).toBe('NOT_DECISION_GRADE');
      expect(isReadinessPositive(truth)).toBe(false);
    });

    it('VERIFIED decision-grade truth contributes to readiness', () => {
      const truth = createCanonicalTruth({
        kind: 'verification',
        satisfied: true,
        coverage: createCanonicalSourceCoverage({
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'CMS NPPES confirmed',
        }),
      });
      expect(truth.status).toBe('VERIFIED');
      expect(isReadinessPositive(truth)).toBe(true);
    });

    it('PENDING truth does not contribute to readiness', () => {
      const truth = createCanonicalTruth({
        kind: 'verification',
        satisfied: false,
        coverage: createCanonicalSourceCoverage({
          sourceId: 'NPPES_API',
          state: 'pending',
          reason: 'not yet run',
        }),
      });
      expect(truth.status).toBe('PENDING');
      expect(isReadinessPositive(truth)).toBe(false);
    });
  });

  describe('entity-by-entity parity — same input → same status across all surfaces', () => {
    const ENTITY_SOURCE_MAP: Record<string, {
      sourceId: string;
      kind: CanonicalTruthKind;
      checkedScenario: { satisfied: boolean; expectedStatus: string };
      gatedScenario: { coverageState: CanonicalSourceCoverageState; expectedStatus: string };
    }> = {
      NPI: {
        sourceId: 'NPPES_API',
        kind: 'verification',
        checkedScenario: { satisfied: true, expectedStatus: 'VERIFIED' },
        gatedScenario: { coverageState: 'accessRequired', expectedStatus: 'ACCESS_REQUIRED' },
      },
      NPDB: {
        sourceId: 'NPDB',
        kind: 'clearance',
        checkedScenario: { satisfied: true, expectedStatus: 'CLEAR' },
        gatedScenario: { coverageState: 'gated', expectedStatus: 'ACCESS_REQUIRED' },
      },
      DEA: {
        sourceId: 'DEA',
        kind: 'verification',
        checkedScenario: { satisfied: true, expectedStatus: 'VERIFIED' },
        gatedScenario: { coverageState: 'notDecisionGrade', expectedStatus: 'NOT_DECISION_GRADE' },
      },
      ABMS: {
        sourceId: 'ABMS',
        kind: 'verification',
        checkedScenario: { satisfied: true, expectedStatus: 'VERIFIED' },
        gatedScenario: { coverageState: 'accessRequired', expectedStatus: 'ACCESS_REQUIRED' },
      },
      STATE_BOARD: {
        sourceId: 'STATE_BOARD',
        kind: 'verification',
        checkedScenario: { satisfied: true, expectedStatus: 'VERIFIED' },
        gatedScenario: { coverageState: 'gated', expectedStatus: 'ACCESS_REQUIRED' },
      },
      OIG_LEIE: {
        sourceId: 'OIG_LEIE',
        kind: 'clearance',
        checkedScenario: { satisfied: true, expectedStatus: 'CLEAR' },
        gatedScenario: { coverageState: 'reviewRequired', expectedStatus: 'REVIEW_REQUIRED' },
      },
      PECOS: {
        sourceId: 'PECOS_PUBLIC',
        kind: 'enrollment',
        checkedScenario: { satisfied: true, expectedStatus: 'ENROLLED' },
        gatedScenario: { coverageState: 'notDecisionGrade', expectedStatus: 'NOT_DECISION_GRADE' },
      },
    };

    for (const [entity, spec] of Object.entries(ENTITY_SOURCE_MAP)) {
      describe(`${entity} (${spec.sourceId})`, () => {
        it(`checked + satisfied → ${spec.checkedScenario.expectedStatus}`, () => {
          const coverage = createCanonicalSourceCoverage({
            sourceId: spec.sourceId,
            state: 'checked',
            reason: `${entity} confirmed`,
          });
          const status = resolveCanonicalTruthStatus({
            kind: spec.kind,
            satisfied: spec.checkedScenario.satisfied,
            coverage,
          });
          expect(status).toBe(spec.checkedScenario.expectedStatus);

          const uiStatus = mapSourceCoverageStateToTrustStatus('checked', {
            kind: spec.kind === 'clearance' ? 'clearance' : spec.kind === 'enrollment' ? 'generic' : 'verification',
            satisfied: true,
          });
          if (spec.kind === 'clearance') expect(uiStatus).toBe('clear');
          else if (spec.kind === 'verification') expect(uiStatus).toBe('verified');
        });

        it(`${spec.gatedScenario.coverageState} → ${spec.gatedScenario.expectedStatus}`, () => {
          const coverage = createCanonicalSourceCoverage({
            sourceId: spec.sourceId,
            state: spec.gatedScenario.coverageState,
            reason: `${entity} gated`,
          });
          const status = resolveCanonicalTruthStatus({
            kind: spec.kind,
            satisfied: false,
            coverage,
          });
          expect(status).toBe(spec.gatedScenario.expectedStatus);
        });

        it(`gated truth status is identified by isGatedTruthStatus`, () => {
          const gatedStatus = spec.gatedScenario.expectedStatus;
          if (gatedStatus === 'ACCESS_REQUIRED' || gatedStatus === 'NOT_DECISION_GRADE') {
            expect(isGatedTruthStatus(gatedStatus as any)).toBe(true);
          }
        });
      });
    }
  });
});

/**
 * 'notFound' exists because 'checked' was carrying two different claims — "we
 * ran the query" and "the source affirmed this subject". Folding a not-found
 * answer into 'checked' put the Source-backed tier next to an NPI that does not
 * exist on the public verifier (prod, 2026-07-27, NPI 1234567893).
 */
describe('notFound — a source that answered, with no record for the subject', () => {
  it('is never decision-grade and never reaches a positive truth status', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'notFound',
      reason: 'NPPES checked but did not return an active identity record',
    });

    // `satisfied: true` is the hostile case: even if an upstream claims the
    // dimension is satisfied, a not-found source must not mint VERIFIED.
    const truth = createCanonicalTruth({ kind: 'verification', satisfied: true, coverage });
    expect(truth.decisionGrade).toBe(false);
    expect(truth.status).not.toBe('VERIFIED');
    expect(isReadinessPositive(truth)).toBe(false);
  });

  it('never renders the source-backed badge', () => {
    expect(sourceCoverageBadgeLabel({ state: 'notFound', decisionGrade: false })).toBe('No active record');
    // The badge helper only mints 'Source-backed' from 'checked'.
    expect(sourceCoverageBadgeLabel({ state: 'notFound', decisionGrade: true })).not.toBe('Source-backed');
  });

  it('stays distinct from unavailable and pending — we DID get an answer', () => {
    expect(mapSourceCoverageStateToTrustStatus('notFound')).toBe('not_found');
    expect(mapSourceCoverageStateToTrustStatus('notFound')).not.toBe(
      mapSourceCoverageStateToTrustStatus('unavailable'),
    );
    expect(mapSourceCoverageStateToTrustStatus('notFound')).not.toBe(
      mapSourceCoverageStateToTrustStatus('pending'),
    );
    // Coverage is complete, so this is not a pipeline-health problem.
    expect(sourceCoveragePosture('notFound')).toBe('partial');
  });

  it('is reachable from the boolean resolver and from upstream spellings', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      notFound: true,
      // The bug shape: an artifact existed, so `checked` was true.
      checked: true,
      fresh: true,
      reason: 'PECOS quarterly release does not show Medicare enrollment for this NPI',
    });
    expect(coverage.state).toBe('notFound');

    expect(normalizeCanonicalSourceCoverageState('NOT_FOUND')).toBe('notFound');
    expect(normalizeCanonicalSourceCoverageState('no_record')).toBe('notFound');
  });

  it('is counted in its own summary bucket, not among checked sources', () => {
    const summary = summarizeCanonicalSourceCoverage([
      { sourceId: 'NPPES_API', state: 'notFound' },
      { sourceId: 'PECOS_PUBLIC', state: 'notFound' },
      { sourceId: 'OIG_LEIE', state: 'checked' },
    ]);

    expect(summary.notFound).toEqual(['NPPES_API', 'PECOS_PUBLIC']);
    expect(summary.checked).toEqual(['OIG_LEIE']);
  });
});
