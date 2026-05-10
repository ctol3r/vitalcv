/**
 * ecosystemReadiness.test.ts — W2-PR140A unit tests
 *
 * Exercises the six ecosystem readiness hard invariants in isolation:
 *   1. Activation replay-safe (every signal must cite a non-breached bundle)
 *   2. Ambiguity preserved during rollout
 *   3. Fail-closed semantics (breach anywhere → ECOSYSTEM_BREACH)
 *   4. Institutional onboarding measurable (convergencePct non-null when ready)
 *   5. Ecosystem survivability longitudinally visible (lineageDigest stable)
 *   6. Ecosystem lineage reconstructable (digest round-trips)
 *
 * Also exercises replay trust activation and rollout acceleration.
 */

import {
  buildEcosystemReadinessReport,
  buildActorReadinessRecord,
  reproduceReadinessLineageDigest,
  assertReadinessAmbiguityPreserved,
  assertEcosystemBreach,
  EcosystemReadinessError,
  KNOWN_ACTOR_ROLES,
  KNOWN_READINESS_GATES,
  KNOWN_ACTOR_READINESS_VERDICTS,
  KNOWN_ECOSYSTEM_VERDICTS,
} from '../ecosystemReadinessWorkflow';
import type {
  ActorReadinessSignal,
  EcosystemReadinessInputs,
  ReadinessGateResult,
} from '../ecosystemReadinessWorkflow';
import {
  evaluateReplayActivation,
  evaluateReplayActivationBatch,
  assertActivationAnchored,
  ActivationError,
} from '../replayTrustActivation';
import type { ReplayActivationInput } from '../replayTrustActivation';
import { buildRolloutAccelerationReport } from '../rolloutAccelerator';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_GATES_PASSED: ReadinessGateResult[] = [
  { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
  { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
  { gate: 'TELEMETRY_LIVE',             outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
  { gate: 'POLICY_ACCEPTED',            outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
  { gate: 'TRUST_CONTRACT_SIGNED',      outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
  { gate: 'AUDIT_TRAIL_VERIFIED',       outcome: 'PASSED', reason: null, replayAnchorBundleId: 'bundle-1' },
];

function makeIssuerSignal(overrides: Partial<ActorReadinessSignal> = {}): ActorReadinessSignal {
  return {
    schema: 'vitalcv.actor-readiness-signal.v1',
    signalId: 'sig-issuer-1',
    observedAt: '2026-05-10T00:00:00.000Z',
    actorId: 'actor-issuer-1',
    actorRole: 'ISSUER',
    institutionId: 'inst-issuer-1',
    sourceBundleId: 'bundle-1',
    gateResults: ALL_GATES_PASSED,
    activationBreach: false,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<EcosystemReadinessInputs> = {}): EcosystemReadinessInputs {
  return {
    signals: [makeIssuerSignal()],
    expectedActors: [{ actorId: 'actor-issuer-1', actorRole: 'ISSUER', institutionId: 'inst-issuer-1' }],
    breachedBundleIds: [],
    ...overrides,
  };
}

function makeActivationInput(overrides: Partial<ReplayActivationInput> = {}): ReplayActivationInput {
  return {
    schema: 'vitalcv.replay-activation-input.v1',
    actorId: 'actor-1',
    institutionId: 'inst-1',
    capsuleId: 'cap-1',
    bundleId: 'bundle-1',
    capsuleHashStored:     'a'.repeat(64),
    capsuleHashRecomputed: 'a'.repeat(64),
    bundleBreached: false,
    corroboratingCapsuleId: null,
    corroboratingHash: null,
    corroboratingRecomputed: null,
    ...overrides,
  };
}

// ── Frozen enum sanity (CI canary) ────────────────────────────────────────────

describe('frozen enum contracts (W2-PR140A)', () => {
  it('KNOWN_ACTOR_ROLES has expected members', () => {
    expect(KNOWN_ACTOR_ROLES).toContain('ISSUER');
    expect(KNOWN_ACTOR_ROLES).toContain('VERIFIER');
    expect(KNOWN_ACTOR_ROLES).toContain('CLINICIAN');
    expect(KNOWN_ACTOR_ROLES).toContain('ENTERPRISE_OPERATOR');
    expect(KNOWN_ACTOR_ROLES).toHaveLength(4);
  });

  it('KNOWN_READINESS_GATES has all required gates', () => {
    expect(KNOWN_READINESS_GATES).toContain('ONBOARDING_COMPLETE');
    expect(KNOWN_READINESS_GATES).toContain('REPLAY_ACTIVATION_ANCHORED');
    expect(KNOWN_READINESS_GATES).toContain('TELEMETRY_LIVE');
    expect(KNOWN_READINESS_GATES).toContain('POLICY_ACCEPTED');
    expect(KNOWN_READINESS_GATES).toContain('TRUST_CONTRACT_SIGNED');
    expect(KNOWN_READINESS_GATES).toContain('AUDIT_TRAIL_VERIFIED');
    expect(KNOWN_READINESS_GATES).toContain('ROLLOUT_SURVIVING');
    expect(KNOWN_READINESS_GATES).toHaveLength(7);
  });

  it('KNOWN_ACTOR_READINESS_VERDICTS is stable', () => {
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toContain('READY');
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toContain('PARTIALLY_READY');
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toContain('READINESS_AMBIGUOUS');
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toContain('NOT_READY');
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toContain('ACTIVATION_BREACH');
    expect(KNOWN_ACTOR_READINESS_VERDICTS).toHaveLength(5);
  });

  it('KNOWN_ECOSYSTEM_VERDICTS is stable', () => {
    expect(KNOWN_ECOSYSTEM_VERDICTS).toContain('ECOSYSTEM_READY');
    expect(KNOWN_ECOSYSTEM_VERDICTS).toContain('ECOSYSTEM_PARTIAL');
    expect(KNOWN_ECOSYSTEM_VERDICTS).toContain('ECOSYSTEM_AMBIGUOUS');
    expect(KNOWN_ECOSYSTEM_VERDICTS).toContain('ECOSYSTEM_NOT_READY');
    expect(KNOWN_ECOSYSTEM_VERDICTS).toContain('ECOSYSTEM_BREACH');
    expect(KNOWN_ECOSYSTEM_VERDICTS).toHaveLength(5);
  });
});

// ── Invariant 1: Replay-safe ───────────────────────────────────────────────────

describe('invariant 1: activation replay-safe (W2-PR140A)', () => {
  it('produces a replay-safe report with deterministic lineageDigest', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-base',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs(),
    });
    expect(report.replaySafe).toBe(true);
    expect(report.overallVerdict).toBe('ECOSYSTEM_READY');
    expect(reproduceReadinessLineageDigest(report)).toBe(report.lineageDigest);
  });

  it('marks report not replay-safe when bundle is breached', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-breach',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs({ breachedBundleIds: ['bundle-1'] }),
    });
    expect(report.replaySafe).toBe(false);
    expect(report.overallVerdict).toBe('ECOSYSTEM_BREACH');
  });
});

// ── Invariant 2: Ambiguity preserved ──────────────────────────────────────────

describe('invariant 2: ambiguity preserved during rollout (W2-PR140A)', () => {
  it('preserves READINESS_AMBIGUOUS when gate outcomes include AMBIGUOUS', () => {
    const ambiguousGates: ReadinessGateResult[] = [
      { gate: 'ONBOARDING_COMPLETE', outcome: 'AMBIGUOUS', reason: 'conflicting signals', replayAnchorBundleId: 'bundle-1' },
      { gate: 'POLICY_ACCEPTED',     outcome: 'PASSED',    reason: null, replayAnchorBundleId: 'bundle-1' },
    ];
    const report = buildEcosystemReadinessReport({
      reportId: 'er-ambig',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs({
        signals: [makeIssuerSignal({ gateResults: ambiguousGates })],
      }),
    });
    expect(report.actorRecords[0].verdict).toBe('READINESS_AMBIGUOUS');
    expect(report.actorRecords[0].convergencePct).toBeNull();
    expect(report.overallVerdict).toBe('ECOSYSTEM_AMBIGUOUS');
    expect(report.ambiguous).toBe(true);
  });

  it('assertReadinessAmbiguityPreserved throws when ambiguous actor has non-null convergence', () => {
    const record = buildActorReadinessRecord(
      makeIssuerSignal({
        gateResults: [
          { gate: 'ONBOARDING_COMPLETE', outcome: 'AMBIGUOUS', reason: 'x', replayAnchorBundleId: 'b1' },
        ],
      }),
      [],
    );
    // Force convergencePct to non-null to simulate a bug
    (record as { convergencePct: number }).convergencePct = 50;
    expect(() => assertReadinessAmbiguityPreserved([record])).toThrow(EcosystemReadinessError);
  });

  it('empty signal slice → ECOSYSTEM_AMBIGUOUS (no default win)', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-empty',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs({ signals: [] }),
    });
    expect(report.overallVerdict).toBe('ECOSYSTEM_AMBIGUOUS');
    expect(report.ambiguous).toBe(true);
    expect(report.systemConvergencePct).toBeNull();
  });
});

// ── Invariant 3: Fail-closed ──────────────────────────────────────────────────

describe('invariant 3: fail-closed readiness semantics (W2-PR140A)', () => {
  it('single breach actor → ECOSYSTEM_BREACH regardless of other cohorts', () => {
    const goodSignal = makeIssuerSignal({ signalId: 'sig-good', actorId: 'actor-good' });
    const breachSignal: ActorReadinessSignal = {
      schema: 'vitalcv.actor-readiness-signal.v1',
      signalId: 'sig-breach',
      observedAt: '2026-05-10T00:00:00.000Z',
      actorId: 'actor-breach',
      actorRole: 'VERIFIER',
      institutionId: 'inst-breach',
      sourceBundleId: 'bundle-breach',
      gateResults: ALL_GATES_PASSED.slice(0, 4),
      activationBreach: false,
    };
    const report = buildEcosystemReadinessReport({
      reportId: 'er-fail-closed',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: {
        signals: [goodSignal, breachSignal],
        expectedActors: [
          { actorId: 'actor-good',   actorRole: 'ISSUER',   institutionId: 'inst-issuer-1' },
          { actorId: 'actor-breach', actorRole: 'VERIFIER', institutionId: 'inst-breach' },
        ],
        breachedBundleIds: ['bundle-breach'],
      },
    });
    expect(report.overallVerdict).toBe('ECOSYSTEM_BREACH');
    expect(report.overallReason).toMatch(/breach/i);
  });

  it('explicit activationBreach flag → ACTIVATION_BREACH (no bundle lookup needed)', () => {
    const sig = makeIssuerSignal({ activationBreach: true });
    const record = buildActorReadinessRecord(sig, []);
    expect(record.verdict).toBe('ACTIVATION_BREACH');
    expect(record.convergencePct).toBeNull();
  });

  it('assertEcosystemBreach throws when verdict is not ECOSYSTEM_BREACH', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-not-breach',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs(),
    });
    expect(() => assertEcosystemBreach(report)).toThrow(EcosystemReadinessError);
  });
});

// ── Invariant 4: Onboarding measurable ───────────────────────────────────────

describe('invariant 4: institutional onboarding measurable (W2-PR140A)', () => {
  it('convergencePct is non-null and correct for a fully passing issuer', () => {
    const record = buildActorReadinessRecord(makeIssuerSignal(), []);
    expect(record.convergencePct).toBe(100);
    expect(record.verdict).toBe('READY');
  });

  it('convergencePct is correct for partial gate pass', () => {
    const partial: ReadinessGateResult[] = [
      { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b1' },
      { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b1' },
      { gate: 'TELEMETRY_LIVE',             outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b1' },
      { gate: 'POLICY_ACCEPTED',            outcome: 'FAILED', reason: 'not signed', replayAnchorBundleId: null },
      { gate: 'TRUST_CONTRACT_SIGNED',      outcome: 'FAILED', reason: 'not signed', replayAnchorBundleId: null },
      { gate: 'AUDIT_TRAIL_VERIFIED',       outcome: 'FAILED', reason: 'missing',    replayAnchorBundleId: null },
    ];
    const record = buildActorReadinessRecord(makeIssuerSignal({ gateResults: partial }), []);
    expect(record.convergencePct).toBe(50);
    expect(record.verdict).toBe('NOT_READY');
  });

  it('onboardingCoveragePct reflects how many expected actors have signals', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-coverage',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: {
        signals: [makeIssuerSignal()],
        expectedActors: [
          { actorId: 'actor-issuer-1', actorRole: 'ISSUER', institutionId: 'inst-issuer-1' },
          { actorId: 'actor-issuer-2', actorRole: 'ISSUER', institutionId: 'inst-issuer-2' },
        ],
        breachedBundleIds: [],
      },
    });
    expect(report.onboardingCoveragePct).toBe(50);
  });
});

// ── Invariant 5: Longitudinally visible ──────────────────────────────────────

describe('invariant 5: ecosystem survivability longitudinally visible (W2-PR140A)', () => {
  it('lineageDigest is stable across two identical builds', () => {
    const inputs = makeInputs();
    const r1 = buildEcosystemReadinessReport({ reportId: 'er-v1', generatedAt: '2026-05-10T00:00:00.000Z', inputs });
    const r2 = buildEcosystemReadinessReport({ reportId: 'er-v1', generatedAt: '2026-05-10T00:00:00.000Z', inputs });
    expect(r1.lineageDigest).toBe(r2.lineageDigest);
  });

  it('lineageDigest changes when an actor verdict changes', () => {
    const r1 = buildEcosystemReadinessReport({
      reportId: 'er-drift',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs(),
    });
    const r2 = buildEcosystemReadinessReport({
      reportId: 'er-drift',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs({ breachedBundleIds: ['bundle-1'] }),
    });
    expect(r1.lineageDigest).not.toBe(r2.lineageDigest);
  });
});

// ── Invariant 6: Lineage reconstructable ─────────────────────────────────────

describe('invariant 6: ecosystem lineage reconstructable (W2-PR140A)', () => {
  it('reproduceReadinessLineageDigest round-trips correctly', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'er-roundtrip',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: makeInputs(),
    });
    expect(reproduceReadinessLineageDigest(report)).toBe(report.lineageDigest);
  });
});

// ── Replay trust activation tests ────────────────────────────────────────────

describe('replayTrustActivation (W2-PR140A)', () => {
  it('ANCHORED when hashes match and bundle is not breached', () => {
    const record = evaluateReplayActivation(makeActivationInput(), '2026-05-10T00:00:00.000Z');
    expect(record.outcome).toBe('ANCHORED');
    expect(record.integrityVerified).toBe(true);
  });

  it('UNANCHORED when capsule hash mismatches', () => {
    const record = evaluateReplayActivation(
      makeActivationInput({ capsuleHashRecomputed: 'b'.repeat(64) }),
      '2026-05-10T00:00:00.000Z',
    );
    expect(record.outcome).toBe('UNANCHORED');
    expect(record.integrityVerified).toBe(false);
  });

  it('ACTIVATION_BREACH when bundle is breached', () => {
    const record = evaluateReplayActivation(
      makeActivationInput({ bundleBreached: true }),
      '2026-05-10T00:00:00.000Z',
    );
    expect(record.outcome).toBe('ACTIVATION_BREACH');
    expect(record.integrityVerified).toBeNull();
  });

  it('ACTIVATION_AMBIGUOUS when primary and corroboration contradict', () => {
    const record = evaluateReplayActivation(
      makeActivationInput({
        corroboratingCapsuleId: 'cap-corr-1',
        corroboratingHash:       'a'.repeat(64),
        corroboratingRecomputed: 'c'.repeat(64), // mismatch while primary matches
      }),
      '2026-05-10T00:00:00.000Z',
    );
    expect(record.outcome).toBe('ACTIVATION_AMBIGUOUS');
    expect(record.integrityVerified).toBeNull();
  });

  it('throws ActivationError for empty capsuleId (phantom activation)', () => {
    expect(() =>
      evaluateReplayActivation(
        makeActivationInput({ capsuleId: '' }),
        '2026-05-10T00:00:00.000Z',
      ),
    ).toThrow(ActivationError);
  });

  it('assertActivationAnchored throws when outcome is UNANCHORED', () => {
    const record = evaluateReplayActivation(
      makeActivationInput({ capsuleHashRecomputed: 'z'.repeat(64) }),
      '2026-05-10T00:00:00.000Z',
    );
    expect(() => assertActivationAnchored(record)).toThrow(ActivationError);
  });

  it('batch evaluator returns one record per input', () => {
    const inputs = [makeActivationInput({ actorId: 'a1' }), makeActivationInput({ actorId: 'a2' })];
    const records = evaluateReplayActivationBatch(inputs, '2026-05-10T00:00:00.000Z');
    expect(records).toHaveLength(2);
    expect(records.every(r => r.outcome === 'ANCHORED')).toBe(true);
  });

  it('activationDigest is deterministic across two identical inputs', () => {
    const input = makeActivationInput();
    const r1 = evaluateReplayActivation(input, '2026-05-10T00:00:00.000Z');
    const r2 = evaluateReplayActivation(input, '2026-05-10T00:00:00.000Z');
    expect(r1.activationDigest).toBe(r2.activationDigest);
  });
});

// ── Rollout accelerator tests ─────────────────────────────────────────────────

describe('rolloutAccelerator (W2-PR140A)', () => {
  it('returns empty bottlenecks and null gain when all actors are READY', () => {
    const readyRecord = buildActorReadinessRecord(makeIssuerSignal(), []);
    const report = buildRolloutAccelerationReport({
      reportId: 'acc-ready',
      generatedAt: '2026-05-10T00:00:00.000Z',
      actorRecords: [readyRecord],
    });
    expect(report.bottlenecks).toHaveLength(0);
    expect(report.systemAccelerationGainPct).toBeNull();
    expect(report.eligibleActorCount).toBe(0);
    expect(report.ineligibleActorCount).toBe(1);
  });

  it('detects POLICY_ACCEPTED as bottleneck for a NOT_READY actor', () => {
    const partial: ReadinessGateResult[] = [
      { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED',  reason: null,       replayAnchorBundleId: 'b1' },
      { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED',  reason: null,       replayAnchorBundleId: 'b1' },
      { gate: 'TELEMETRY_LIVE',             outcome: 'PASSED',  reason: null,       replayAnchorBundleId: 'b1' },
      { gate: 'POLICY_ACCEPTED',            outcome: 'FAILED',  reason: 'not signed', replayAnchorBundleId: null },
      { gate: 'TRUST_CONTRACT_SIGNED',      outcome: 'FAILED',  reason: 'not signed', replayAnchorBundleId: null },
      { gate: 'AUDIT_TRAIL_VERIFIED',       outcome: 'FAILED',  reason: 'missing',    replayAnchorBundleId: null },
    ];
    const record = buildActorReadinessRecord(makeIssuerSignal({ gateResults: partial }), []);
    const report = buildRolloutAccelerationReport({
      reportId: 'acc-bottleneck',
      generatedAt: '2026-05-10T00:00:00.000Z',
      actorRecords: [record],
    });
    expect(report.bottlenecks.length).toBeGreaterThan(0);
    expect(report.eligibleActorCount).toBe(1);
    expect(report.systemAccelerationGainPct).not.toBeNull();
  });

  it('accelerationDigest is deterministic', () => {
    const record = buildActorReadinessRecord(makeIssuerSignal({
      gateResults: [
        { gate: 'ONBOARDING_COMPLETE', outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b1' },
        { gate: 'POLICY_ACCEPTED',     outcome: 'FAILED', reason: 'x',  replayAnchorBundleId: null },
      ],
    }), []);
    const r1 = buildRolloutAccelerationReport({ reportId: 'acc-determ', generatedAt: '2026-05-10T00:00:00.000Z', actorRecords: [record] });
    const r2 = buildRolloutAccelerationReport({ reportId: 'acc-determ', generatedAt: '2026-05-10T00:00:00.000Z', actorRecords: [record] });
    expect(r1.accelerationDigest).toBe(r2.accelerationDigest);
  });

  it('projectedConvergencePct is bounded at 100', () => {
    const readyRecord = buildActorReadinessRecord(makeIssuerSignal(), []);
    const report = buildRolloutAccelerationReport({
      reportId: 'acc-cap',
      generatedAt: '2026-05-10T00:00:00.000Z',
      actorRecords: [readyRecord],
    });
    for (const opp of report.opportunities) {
      expect(opp.projectedConvergencePct).toBeLessThanOrEqual(100);
    }
  });
});

// ── Multi-cohort ecosystem ─────────────────────────────────────────────────────

describe('multi-cohort ecosystem readiness (W2-PR140A)', () => {
  it('builds cohorts per role and computes systemConvergencePct', () => {
    const clinicianGates: ReadinessGateResult[] = [
      { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b2' },
      { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b2' },
      { gate: 'POLICY_ACCEPTED',            outcome: 'PASSED', reason: null, replayAnchorBundleId: 'b2' },
    ];
    const clinicianSignal: ActorReadinessSignal = {
      schema: 'vitalcv.actor-readiness-signal.v1',
      signalId: 'sig-clinician-1',
      observedAt: '2026-05-10T00:00:00.000Z',
      actorId: 'actor-clinician-1',
      actorRole: 'CLINICIAN',
      institutionId: 'inst-clinic-1',
      sourceBundleId: 'bundle-2',
      gateResults: clinicianGates,
      activationBreach: false,
    };
    const report = buildEcosystemReadinessReport({
      reportId: 'er-multi',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: {
        signals: [makeIssuerSignal(), clinicianSignal],
        expectedActors: [
          { actorId: 'actor-issuer-1',    actorRole: 'ISSUER',    institutionId: 'inst-issuer-1' },
          { actorId: 'actor-clinician-1', actorRole: 'CLINICIAN', institutionId: 'inst-clinic-1' },
        ],
        breachedBundleIds: [],
      },
    });
    expect(report.cohorts).toHaveLength(2);
    expect(report.overallVerdict).toBe('ECOSYSTEM_READY');
    expect(report.systemConvergencePct).not.toBeNull();
    expect(report.systemConvergencePct).toBeGreaterThan(0);
  });
});
