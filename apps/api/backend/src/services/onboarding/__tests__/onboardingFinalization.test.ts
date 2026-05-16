/**
 * onboardingFinalization.test.ts — W2-PR167A unit gate
 *
 * Verifies the core invariants for all five onboarding finalization engines:
 *   1. Convergence — fail-closed, ambiguity preserved, lineage reconstructable
 *   2. Replay-safe activation — lineage missing/tampered surfaces correctly
 *   3. Cross-org harmonization — disagreements preserved, score correct
 *   4. Institutional telemetry — cohort grouping, longitudinal curves
 *   5. Activation simplicity scoring — friction factors, role averages
 */

import {
  buildOnboardingConvergenceReport,
  reproduceConvergenceLineageDigest,
} from '../onboardingConvergence';
import {
  buildReplayActivationRecord,
  buildActivationReplayBatch,
  replayRecordToSignal,
} from '../replaySafeActivation';
import { buildCrossOrgHarmonizationReport } from '../crossOrgHarmonization';
import { buildInstitutionalTelemetryReport } from '../institutionalOnboardingTelemetry';
import { buildActivationSimplicityReport } from '../activationSimplicityScoring';
import {
  makeSignal,
  makeEntity,
  makeLineageRef,
  makeReplayInput,
  makeEntitySignals,
  makeMultiOrgSignals,
} from '../_testFixtures';

// ── 1. Convergence engine ─────────────────────────────────────────────────────

describe('onboarding convergence (W2-PR167A)', () => {
  it('empty signal slice → CONVERGENCE_AMBIGUOUS, score 0', () => {
    const report = buildOnboardingConvergenceReport({
      signals: [],
      entities: [],
      sliceWindowIso: '2026-W18',
    });
    expect(report.verdict).toBe('CONVERGENCE_AMBIGUOUS');
    expect(report.ecosystemConvergenceScore).toBe(0);
  });

  it('missing audit lineage forces CONVERGENCE_BREACH', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', sourceAuditLineageId: null }),
    ];
    const entities = [makeEntity('e1', 'ISSUER')];
    const report = buildOnboardingConvergenceReport({
      signals,
      entities,
      sliceWindowIso: '2026-W18',
    });
    expect(report.verdict).toBe('CONVERGENCE_BREACH');
    expect(report.breachCount).toBeGreaterThan(0);
  });

  it('contradictory milestone states surface as CONVERGENCE_AMBIGUOUS', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', milestoneStatus: 'COMPLETED' }),
      makeSignal({ signalId: 's2', entityId: 'e1', milestoneId: 'm1', milestoneStatus: 'BLOCKED' }),
    ];
    const entities = [makeEntity('e1', 'ISSUER')];
    const report = buildOnboardingConvergenceReport({
      signals,
      entities,
      sliceWindowIso: '2026-W18',
    });
    expect(report.verdict).toBe('CONVERGENCE_AMBIGUOUS');
    expect(report.ambiguities).toHaveLength(1);
    expect(report.ambiguities[0].milestoneId).toBe('m1');
  });

  it('fully completed entities with valid lineage → CONVERGED', () => {
    const milestones = ['register', 'haip', 'test', 'review', 'activate'];
    const signals = makeEntitySignals('e1', milestones, 'ISSUER', 'org-a');
    const entities = [makeEntity('e1', 'ISSUER', 'org-a')];
    const report = buildOnboardingConvergenceReport({
      signals,
      entities,
      sliceWindowIso: '2026-W18',
    });
    expect(report.verdict).toBe('CONVERGED');
    expect(report.ecosystemConvergenceScore).toBeGreaterThan(80);
  });

  it('lineageDigest is deterministic — same inputs always same digest', () => {
    const signals = [
      makeSignal({ signalId: 'sig-a', entityId: 'e1', milestoneId: 'register' }),
      makeSignal({ signalId: 'sig-b', entityId: 'e2', milestoneId: 'haip' }),
    ];
    const d1 = reproduceConvergenceLineageDigest(signals, '2026-W18');
    const d2 = reproduceConvergenceLineageDigest(signals, '2026-W18');
    expect(d1).toBe(d2);
    expect(d1).toHaveLength(64);
  });

  it('reports include all roles that have entities', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'c1', milestoneId: 'npi', role: 'CLINICIAN' }),
      makeSignal({ signalId: 's2', entityId: 'v1', milestoneId: 'sdk', role: 'VERIFIER' }),
    ];
    const entities = [
      makeEntity('c1', 'CLINICIAN'),
      makeEntity('v1', 'VERIFIER'),
    ];
    const report = buildOnboardingConvergenceReport({ signals, entities, sliceWindowIso: '2026-W18' });
    expect(report.roleConvergence.CLINICIAN).toBeDefined();
    expect(report.roleConvergence.VERIFIER).toBeDefined();
    expect(report.roleConvergence.ISSUER).toBeUndefined();
  });
});

// ── 2. Replay-safe activation ─────────────────────────────────────────────────

describe('replay-safe activation (W2-PR167A)', () => {
  it('no lineageRef → LINEAGE_MISSING', () => {
    const record = buildReplayActivationRecord(
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: null }),
    );
    expect(record.lineageVerdict).toBe('LINEAGE_MISSING');
  });

  it('matching lineage digest → LINEAGE_VERIFIED', () => {
    const ref = makeLineageRef('lin-1', 'abc123');
    const record = buildReplayActivationRecord(
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: ref, currentLineageDigest: 'abc123' }),
    );
    expect(record.lineageVerdict).toBe('LINEAGE_VERIFIED');
  });

  it('mismatched lineage digest → LINEAGE_TAMPERED', () => {
    const ref = makeLineageRef('lin-1', 'abc123');
    const record = buildReplayActivationRecord(
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: ref, currentLineageDigest: 'TAMPERED' }),
    );
    expect(record.lineageVerdict).toBe('LINEAGE_TAMPERED');
  });

  it('recordDigest is deterministic', () => {
    const input = makeReplayInput({ entityId: 'e1', milestoneId: 'register' });
    const r1 = buildReplayActivationRecord(input);
    const r2 = buildReplayActivationRecord(input);
    expect(r1.recordDigest).toBe(r2.recordDigest);
  });

  it('batch summary counts lineage verdicts correctly', () => {
    const inputs = [
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: null }),
      makeReplayInput({ entityId: 'e2', milestoneId: 'haip' }),
      makeReplayInput({ entityId: 'e3', milestoneId: 'test', lineageRef: makeLineageRef('l', 'x'), currentLineageDigest: 'WRONG' }),
    ];
    const batch = buildActivationReplayBatch(inputs);
    expect(batch.missingLineageCount).toBe(1);
    expect(batch.tamperedLineageCount).toBe(1);
    expect(batch.verifiedLineageCount).toBe(1);
  });

  it('replayRecordToSignal nullifies lineageId when not verified', () => {
    const record = buildReplayActivationRecord(
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: null }),
    );
    const signal = replayRecordToSignal(record);
    expect(signal.sourceAuditLineageId).toBeNull();
  });

  it('replayRecordToSignal preserves lineageId when verified', () => {
    const ref = makeLineageRef('lin-1', 'abc123');
    const record = buildReplayActivationRecord(
      makeReplayInput({ entityId: 'e1', milestoneId: 'register', lineageRef: ref, currentLineageDigest: 'abc123' }),
    );
    const signal = replayRecordToSignal(record);
    expect(signal.sourceAuditLineageId).toBe('lin-1');
  });
});

// ── 3. Cross-org harmonization ────────────────────────────────────────────────

describe('cross-org harmonization (W2-PR167A)', () => {
  it('empty signal set → HARMONY_AMBIGUOUS, score 0', () => {
    const report = buildCrossOrgHarmonizationReport({ signals: [], sliceWindowIso: '2026-W18' });
    expect(report.verdict).toBe('HARMONY_AMBIGUOUS');
    expect(report.crossOrgReadinessScore).toBe(0);
  });

  it('same entity same status across orgs → HARMONIZED', () => {
    const signals = makeMultiOrgSignals(
      'e1',
      'register',
      [{ orgId: 'org-a', status: 'COMPLETED' }, { orgId: 'org-b', status: 'COMPLETED' }],
    );
    const report = buildCrossOrgHarmonizationReport({ signals, sliceWindowIso: '2026-W18' });
    expect(report.verdict).toBe('HARMONIZED');
    expect(report.crossOrgReadinessScore).toBe(100);
    expect(report.totalDisagreements).toBe(0);
  });

  it('conflicting status across orgs → DISHARMONY, disagreement preserved', () => {
    const signals = makeMultiOrgSignals(
      'e1',
      'register',
      [{ orgId: 'org-a', status: 'COMPLETED' }, { orgId: 'org-b', status: 'BLOCKED' }],
    );
    const report = buildCrossOrgHarmonizationReport({ signals, sliceWindowIso: '2026-W18' });
    expect(report.verdict).toBe('DISHARMONY');
    expect(report.totalDisagreements).toBeGreaterThan(0);
    const entityState = report.entityStates.find((e) => e.entityId === 'e1');
    expect(entityState?.milestoneAgreements[0].conflicts).toHaveLength(1);
    // Both statuses preserved — not silently merged
    const conflict = entityState?.milestoneAgreements[0].conflicts[0];
    expect([conflict?.statusA, conflict?.statusB].sort()).toEqual(['BLOCKED', 'COMPLETED']);
  });

  it('harmonizationDigest is deterministic', () => {
    const signals = makeMultiOrgSignals('e1', 'register', [
      { orgId: 'org-a', status: 'COMPLETED' },
      { orgId: 'org-b', status: 'COMPLETED' },
    ]);
    const r1 = buildCrossOrgHarmonizationReport({ signals, sliceWindowIso: '2026-W18' });
    const r2 = buildCrossOrgHarmonizationReport({ signals, sliceWindowIso: '2026-W18' });
    expect(r1.harmonizationDigest).toBe(r2.harmonizationDigest);
  });

  it('partial harmony when some entities agree and some conflict', () => {
    const s1 = makeMultiOrgSignals('eA', 'haip', [
      { orgId: 'org-a', status: 'COMPLETED' },
      { orgId: 'org-b', status: 'COMPLETED' },
    ]);
    const s2 = makeMultiOrgSignals('eB', 'haip', [
      { orgId: 'org-a', status: 'COMPLETED' },
      { orgId: 'org-b', status: 'BLOCKED' },
    ]);
    const report = buildCrossOrgHarmonizationReport({ signals: [...s1, ...s2], sliceWindowIso: '2026-W18' });
    expect(report.verdict).toBe('PARTIAL_HARMONY');
    expect(report.crossOrgReadinessScore).toBe(50);
  });
});

// ── 4. Institutional telemetry ────────────────────────────────────────────────

describe('institutional onboarding telemetry (W2-PR167A)', () => {
  it('groups signals into monthly cohorts', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', observedAt: '2026-01-15T00:00:00.000Z' }),
      makeSignal({ signalId: 's2', entityId: 'e2', milestoneId: 'm1', observedAt: '2026-02-15T00:00:00.000Z' }),
    ];
    const report = buildInstitutionalTelemetryReport({ signals, resolution: 'MONTH' });
    expect(report.cohorts).toHaveLength(2);
    const janCohort = report.cohorts.find((c) => c.cohortKey === '2026-01');
    const febCohort = report.cohorts.find((c) => c.cohortKey === '2026-02');
    expect(janCohort?.enrolledCount).toBe(1);
    expect(febCohort?.enrolledCount).toBe(1);
  });

  it('activation rate = 100 when all entities have COMPLETED milestone', () => {
    const signals = makeEntitySignals('e1', ['m1', 'm2'], 'ISSUER', 'org-a');
    const report = buildInstitutionalTelemetryReport({ signals, resolution: 'MONTH' });
    expect(report.overallActivationRate).toBe(100);
    expect(report.totalActivatedEntities).toBe(1);
  });

  it('activation rate = 0 when no COMPLETED milestones', () => {
    const signals = makeEntitySignals('e1', ['m1', 'm2'], 'ISSUER', 'org-a', 'PENDING');
    const report = buildInstitutionalTelemetryReport({ signals, resolution: 'MONTH' });
    expect(report.overallActivationRate).toBe(0);
  });

  it('telemetryDigest is deterministic across N=10 rebuilds', () => {
    const signals = makeEntitySignals('e1', ['m1', 'm2', 'm3'], 'VERIFIER', 'org-b');
    const digests = Array.from({ length: 10 }, () =>
      buildInstitutionalTelemetryReport({ signals, resolution: 'WEEK' }).telemetryDigest,
    );
    expect(new Set(digests).size).toBe(1);
  });

  it('longitudinal curves accumulate across cohorts', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', role: 'ISSUER', observedAt: '2026-01-10T00:00:00.000Z' }),
      makeSignal({ signalId: 's2', entityId: 'e2', milestoneId: 'm1', role: 'ISSUER', observedAt: '2026-02-10T00:00:00.000Z' }),
      makeSignal({ signalId: 's3', entityId: 'e3', milestoneId: 'm1', role: 'ISSUER', observedAt: '2026-03-10T00:00:00.000Z' }),
    ];
    const report = buildInstitutionalTelemetryReport({ signals, resolution: 'MONTH' });
    const curve = report.longitudinalCurves.ISSUER;
    expect(curve).toBeDefined();
    expect(curve!.length).toBe(3);
    // Cumulative should be non-decreasing
    for (let i = 1; i < curve!.length; i++) {
      expect(curve![i].cumulativeActivations).toBeGreaterThanOrEqual(curve![i - 1].cumulativeActivations);
    }
  });
});

// ── 5. Activation simplicity scoring ─────────────────────────────────────────

describe('activation simplicity scoring (W2-PR167A)', () => {
  it('all completed, no friction → score near 100', () => {
    const signals = makeEntitySignals('e1', ['m1', 'm2', 'm3', 'm4', 'm5'], 'ISSUER', 'org-a');
    const report = buildActivationSimplicityReport({ signals });
    const entity = report.entityScores.find((e) => e.entityId === 'e1');
    expect(entity?.simplicityScore).toBe(100);
    expect(entity?.frictionFactors).toHaveLength(0);
  });

  it('blocked milestones reduce score', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', milestoneStatus: 'BLOCKED' }),
      makeSignal({ signalId: 's2', entityId: 'e1', milestoneId: 'm2', milestoneStatus: 'COMPLETED' }),
    ];
    const report = buildActivationSimplicityReport({ signals });
    const entity = report.entityScores.find((e) => e.entityId === 'e1');
    expect(entity?.simplicityScore).toBeLessThan(100);
    expect(entity?.frictionFactors.some((f) => f.includes('blocked'))).toBe(true);
  });

  it('missing audit lineage adds penalty', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', milestoneStatus: 'COMPLETED', sourceAuditLineageId: null }),
    ];
    const report = buildActivationSimplicityReport({ signals });
    const entity = report.entityScores.find((e) => e.entityId === 'e1');
    expect(entity?.missingLineagePenalty).toBeGreaterThan(0);
    expect(entity?.simplicityScore).toBeLessThan(100);
  });

  it('score is bounded 0-100', () => {
    const signals = [
      makeSignal({ signalId: 's1', entityId: 'e1', milestoneId: 'm1', milestoneStatus: 'BLOCKED' }),
      makeSignal({ signalId: 's2', entityId: 'e1', milestoneId: 'm2', milestoneStatus: 'BLOCKED' }),
      makeSignal({ signalId: 's3', entityId: 'e1', milestoneId: 'm3', milestoneStatus: 'BLOCKED' }),
      makeSignal({ signalId: 's4', entityId: 'e1', milestoneId: 'm4', milestoneStatus: 'BLOCKED', sourceAuditLineageId: null }),
    ];
    const report = buildActivationSimplicityReport({ signals });
    const entity = report.entityScores.find((e) => e.entityId === 'e1');
    expect(entity?.simplicityScore).toBeGreaterThanOrEqual(0);
    expect(entity?.simplicityScore).toBeLessThanOrEqual(100);
  });

  it('role-level average is computed correctly', () => {
    const s1 = makeEntitySignals('e1', ['m1', 'm2', 'm3', 'm4', 'm5'], 'ISSUER', 'org-a');
    const s2 = [
      makeSignal({ signalId: 'b1', entityId: 'e2', milestoneId: 'm1', role: 'ISSUER', milestoneStatus: 'BLOCKED' }),
    ];
    const report = buildActivationSimplicityReport({ signals: [...s1, ...s2] });
    const roleState = report.roleSimplicity.ISSUER;
    expect(roleState?.entityCount).toBe(2);
    expect(roleState?.avgSimplicityScore).toBeGreaterThan(0);
    expect(roleState?.avgSimplicityScore).toBeLessThan(100);
  });

  it('scoringDigest is deterministic', () => {
    const signals = makeEntitySignals('e1', ['m1', 'm2'], 'VERIFIER', 'org-b');
    const d1 = buildActivationSimplicityReport({ signals }).scoringDigest;
    const d2 = buildActivationSimplicityReport({ signals }).scoringDigest;
    expect(d1).toBe(d2);
  });

  it('empty signals → ecosystem score 0', () => {
    const report = buildActivationSimplicityReport({ signals: [] });
    expect(report.ecosystemSimplicityScore).toBe(0);
  });
});
