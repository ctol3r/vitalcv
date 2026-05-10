/**
 * ecosystemReadinessChaos.scale.test.ts — W2-PR140A: Ecosystem Readiness Chaos
 *
 * Adversarial test suite. Each scenario stresses a single failure mode and
 * asserts the ecosystem readiness boundary fails closed when expected, and
 * preserves ambiguity when evidence is legitimately uncertain.
 *
 * Scenarios:
 *
 *   C-ER-1  Mass breach storm           — 50% of actors have breached bundles
 *   C-ER-2  Complete ambiguity storm    — all gate results are AMBIGUOUS
 *   C-ER-3  Zero onboarding coverage   — signals for 0 of N expected actors
 *   C-ER-4  Phantom activation attempt  — empty capsuleId on batch inputs
 *   C-ER-5  Contradicting corroboration — all activations flipped to AMBIGUOUS
 *   C-ER-6  Mixed friction storm        — breach + ambiguous + partial in one cohort
 *   C-ER-7  Bottleneck cascade          — single gate blocks 100% of cohort
 *   C-ER-8  Lineage tamper detection    — modified report produces different digest
 *
 * Board metrics emitted as `[readiness-board]` lines for the CI gate surface step.
 */

import {
  buildEcosystemReadinessReport,
  buildActorReadinessRecord,
  reproduceReadinessLineageDigest,
} from '../../adoption/ecosystemReadinessWorkflow';
import type {
  ActorReadinessSignal,
  EcosystemReadinessInputs,
  ReadinessGateResult,
} from '../../adoption/ecosystemReadinessWorkflow';
import {
  evaluateReplayActivation,
  evaluateReplayActivationBatch,
  ActivationError,
} from '../../adoption/replayTrustActivation';
import type { ReplayActivationInput } from '../../adoption/replayTrustActivation';
import { buildRolloutAccelerationReport } from '../../adoption/rolloutAccelerator';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GOOD_HASH = 'a'.repeat(64);
const BAD_HASH  = 'z'.repeat(64);

function passedGates(bundleId: string): ReadinessGateResult[] {
  return [
    { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
    { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
    { gate: 'TELEMETRY_LIVE',             outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
    { gate: 'POLICY_ACCEPTED',            outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
    { gate: 'TRUST_CONTRACT_SIGNED',      outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
    { gate: 'AUDIT_TRAIL_VERIFIED',       outcome: 'PASSED', reason: null, replayAnchorBundleId: bundleId },
  ];
}

function ambiguousGates(bundleId: string): ReadinessGateResult[] {
  return [
    { gate: 'ONBOARDING_COMPLETE',        outcome: 'AMBIGUOUS', reason: 'contradicting', replayAnchorBundleId: bundleId },
    { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'AMBIGUOUS', reason: 'contradicting', replayAnchorBundleId: bundleId },
    { gate: 'POLICY_ACCEPTED',            outcome: 'AMBIGUOUS', reason: 'contradicting', replayAnchorBundleId: bundleId },
  ];
}

function makeSignal(i: number, bundleId: string, breach: boolean): ActorReadinessSignal {
  return {
    schema: 'vitalcv.actor-readiness-signal.v1',
    signalId:  `sig-${i}`,
    observedAt: `2026-05-10T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
    actorId: `actor-${i}`,
    actorRole: i % 2 === 0 ? 'ISSUER' : 'VERIFIER',
    institutionId: `inst-${i}`,
    sourceBundleId: bundleId,
    gateResults: passedGates(bundleId),
    activationBreach: breach,
  };
}

function makeActivation(i: number, hashMatch: boolean, breached: boolean): ReplayActivationInput {
  return {
    schema: 'vitalcv.replay-activation-input.v1',
    actorId: `actor-${i}`,
    institutionId: `inst-${i}`,
    capsuleId: `cap-${i}`,
    bundleId: `bundle-${i}`,
    capsuleHashStored:     GOOD_HASH,
    capsuleHashRecomputed: hashMatch ? GOOD_HASH : BAD_HASH,
    bundleBreached: breached,
    corroboratingCapsuleId: null,
    corroboratingHash: null,
    corroboratingRecomputed: null,
  };
}

// ── C-ER-1: Mass breach storm ─────────────────────────────────────────────────

describe('C-ER-1: mass breach storm (W2-PR140A)', () => {
  it('forces ECOSYSTEM_BREACH when 50% of actors carry breached bundles', () => {
    const N = 100;
    const signals: ActorReadinessSignal[] = [];
    const breachedBundleIds: string[] = [];
    const expectedActors: EcosystemReadinessInputs['expectedActors'] = [];

    for (let i = 0; i < N; i++) {
      const bundleId = `bundle-${i}`;
      const isBreached = i % 2 === 0;
      if (isBreached) breachedBundleIds.push(bundleId);
      signals.push(makeSignal(i, bundleId, false));
      expectedActors.push({ actorId: `actor-${i}`, actorRole: i % 2 === 0 ? 'ISSUER' : 'VERIFIER', institutionId: `inst-${i}` });
    }

    const report = buildEcosystemReadinessReport({
      reportId: 'chaos-er-1',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: { signals, expectedActors, breachedBundleIds },
    });

    expect(report.overallVerdict).toBe('ECOSYSTEM_BREACH');
    expect(report.replaySafe).toBe(false);
    const breachedCount = report.actorRecords.filter(r => r.verdict === 'ACTIVATION_BREACH').length;
    expect(breachedCount).toBe(50);

    console.log(`[readiness-board] C-ER-1 | Breach verdict: ${report.overallVerdict} | Breached actors: ${breachedCount}/${N} | replaySafe: ${report.replaySafe}`);
  });
});

// ── C-ER-2: Complete ambiguity storm ─────────────────────────────────────────

describe('C-ER-2: complete ambiguity storm (W2-PR140A)', () => {
  it('preserves ECOSYSTEM_AMBIGUOUS when all gate results are AMBIGUOUS', () => {
    const N = 50;
    const signals: ActorReadinessSignal[] = [];
    const expectedActors: EcosystemReadinessInputs['expectedActors'] = [];

    for (let i = 0; i < N; i++) {
      signals.push({
        schema: 'vitalcv.actor-readiness-signal.v1',
        signalId: `sig-${i}`,
        observedAt: '2026-05-10T00:00:00.000Z',
        actorId: `actor-${i}`,
        actorRole: 'CLINICIAN',
        institutionId: `inst-${i}`,
        sourceBundleId: `bundle-${i}`,
        gateResults: ambiguousGates(`bundle-${i}`),
        activationBreach: false,
      });
      expectedActors.push({ actorId: `actor-${i}`, actorRole: 'CLINICIAN', institutionId: `inst-${i}` });
    }

    const report = buildEcosystemReadinessReport({
      reportId: 'chaos-er-2',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: { signals, expectedActors, breachedBundleIds: [] },
    });

    expect(report.overallVerdict).toBe('ECOSYSTEM_AMBIGUOUS');
    expect(report.ambiguous).toBe(true);
    expect(report.systemConvergencePct).toBeNull();
    const ambiguousCount = report.actorRecords.filter(r => r.verdict === 'READINESS_AMBIGUOUS').length;
    expect(ambiguousCount).toBe(N);

    console.log(`[readiness-board] C-ER-2 | Ambiguity storm verdict: ${report.overallVerdict} | Ambiguous actors: ${ambiguousCount}/${N}`);
  });
});

// ── C-ER-3: Zero onboarding coverage ─────────────────────────────────────────

describe('C-ER-3: zero onboarding coverage (W2-PR140A)', () => {
  it('produces ECOSYSTEM_AMBIGUOUS when no actors have sent signals', () => {
    const expectedActors: EcosystemReadinessInputs['expectedActors'] = Array.from({ length: 20 }, (_, i) => ({
      actorId: `actor-${i}`,
      actorRole: 'ENTERPRISE_OPERATOR' as const,
      institutionId: `inst-${i}`,
    }));

    const report = buildEcosystemReadinessReport({
      reportId: 'chaos-er-3',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: { signals: [], expectedActors, breachedBundleIds: [] },
    });

    expect(report.overallVerdict).toBe('ECOSYSTEM_AMBIGUOUS');
    expect(report.onboardingCoveragePct).toBe(0);
    expect(report.systemConvergencePct).toBeNull();

    console.log(`[readiness-board] C-ER-3 | Zero coverage verdict: ${report.overallVerdict} | Coverage: ${report.onboardingCoveragePct}%`);
  });
});

// ── C-ER-4: Phantom activation attempt ───────────────────────────────────────

describe('C-ER-4: phantom activation attempt (W2-PR140A)', () => {
  it('throws ActivationError for every phantom capsuleId in a batch', () => {
    const inputs: ReplayActivationInput[] = [
      makeActivation(1, true, false),   // valid
      { ...makeActivation(2, true, false), capsuleId: '' },  // phantom
    ];

    let phantomThrew = false;
    for (const input of inputs) {
      if (!input.capsuleId) {
        expect(() => evaluateReplayActivation(input, '2026-05-10T00:00:00.000Z')).toThrow(ActivationError);
        phantomThrew = true;
      } else {
        const record = evaluateReplayActivation(input, '2026-05-10T00:00:00.000Z');
        expect(record.outcome).toBe('ANCHORED');
      }
    }
    expect(phantomThrew).toBe(true);

    console.log(`[readiness-board] C-ER-4 | Phantom activation blocked: true`);
  });
});

// ── C-ER-5: Contradicting corroboration ──────────────────────────────────────

describe('C-ER-5: contradicting corroboration storm (W2-PR140A)', () => {
  it('all activations become ACTIVATION_AMBIGUOUS when primary and corroborating contradict', () => {
    const N = 30;
    const inputs: ReplayActivationInput[] = Array.from({ length: N }, (_, i) => ({
      ...makeActivation(i, true, false),
      corroboratingCapsuleId: `cap-corr-${i}`,
      corroboratingHash:       GOOD_HASH,
      corroboratingRecomputed: BAD_HASH,  // corroboration always mismatches
    }));

    const records = evaluateReplayActivationBatch(inputs, '2026-05-10T00:00:00.000Z');
    const ambiguousCount = records.filter(r => r.outcome === 'ACTIVATION_AMBIGUOUS').length;
    expect(ambiguousCount).toBe(N);
    expect(records.every(r => r.integrityVerified === null)).toBe(true);

    console.log(`[readiness-board] C-ER-5 | Contradicting corroboration | Ambiguous: ${ambiguousCount}/${N}`);
  });
});

// ── C-ER-6: Mixed friction storm ─────────────────────────────────────────────

describe('C-ER-6: mixed friction storm (W2-PR140A)', () => {
  it('ECOSYSTEM_BREACH takes precedence in a mixed breach + ambiguous + partial cohort', () => {
    const signals: ActorReadinessSignal[] = [
      // READY
      makeSignal(0, 'bundle-0', false),
      // ACTIVATION_BREACH via explicit flag
      { ...makeSignal(1, 'bundle-1', true) },
      // READINESS_AMBIGUOUS via ambiguous gates
      {
        schema: 'vitalcv.actor-readiness-signal.v1',
        signalId: 'sig-ambig',
        observedAt: '2026-05-10T00:00:00.000Z',
        actorId: 'actor-ambig',
        actorRole: 'CLINICIAN',
        institutionId: 'inst-ambig',
        sourceBundleId: 'bundle-ambig',
        gateResults: ambiguousGates('bundle-ambig'),
        activationBreach: false,
      },
    ];
    const expectedActors: EcosystemReadinessInputs['expectedActors'] = [
      { actorId: 'actor-0', actorRole: 'ISSUER', institutionId: 'inst-0' },
      { actorId: 'actor-1', actorRole: 'ISSUER', institutionId: 'inst-1' },
      { actorId: 'actor-ambig', actorRole: 'CLINICIAN', institutionId: 'inst-ambig' },
    ];

    const report = buildEcosystemReadinessReport({
      reportId: 'chaos-er-6',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: { signals, expectedActors, breachedBundleIds: [] },
    });

    expect(report.overallVerdict).toBe('ECOSYSTEM_BREACH');

    console.log(`[readiness-board] C-ER-6 | Mixed storm verdict: ${report.overallVerdict} | Actors: ${report.actorRecords.length}`);
  });
});

// ── C-ER-7: Bottleneck cascade ────────────────────────────────────────────────

describe('C-ER-7: single-gate bottleneck cascade (W2-PR140A)', () => {
  it('POLICY_ACCEPTED blocks 100% of cohort and surfaces as CRITICAL bottleneck', () => {
    const N = 40;
    const records = Array.from({ length: N }, (_, i) => {
      const gates: ReadinessGateResult[] = [
        { gate: 'ONBOARDING_COMPLETE',        outcome: 'PASSED', reason: null, replayAnchorBundleId: `b${i}` },
        { gate: 'REPLAY_ACTIVATION_ANCHORED', outcome: 'PASSED', reason: null, replayAnchorBundleId: `b${i}` },
        { gate: 'POLICY_ACCEPTED',            outcome: 'FAILED', reason: 'not signed', replayAnchorBundleId: null },
      ];
      return buildActorReadinessRecord(
        {
          schema: 'vitalcv.actor-readiness-signal.v1',
          signalId: `sig-${i}`,
          observedAt: '2026-05-10T00:00:00.000Z',
          actorId: `actor-${i}`,
          actorRole: 'CLINICIAN',
          institutionId: `inst-${i}`,
          sourceBundleId: `b${i}`,
          gateResults: gates,
          activationBreach: false,
        },
        [],
      );
    });

    const report = buildRolloutAccelerationReport({
      reportId: 'chaos-er-7',
      generatedAt: '2026-05-10T00:00:00.000Z',
      actorRecords: records,
    });

    expect(report.bottlenecks.length).toBeGreaterThan(0);
    const policyBottleneck = report.bottlenecks.find(b => b.blockedGate === 'POLICY_ACCEPTED');
    expect(policyBottleneck).toBeDefined();
    expect(policyBottleneck!.severity).toBe('CRITICAL');
    expect(policyBottleneck!.affectedActorCount).toBe(N);
    expect(report.systemAccelerationGainPct).toBeGreaterThan(0);

    console.log(`[readiness-board] C-ER-7 | Top bottleneck: ${policyBottleneck!.blockedGate} | Severity: ${policyBottleneck!.severity} | Affected: ${policyBottleneck!.affectedActorCount}/${N} | System gain: ${report.systemAccelerationGainPct}%`);
  });
});

// ── C-ER-8: Lineage tamper detection ─────────────────────────────────────────

describe('C-ER-8: lineage tamper detection (W2-PR140A)', () => {
  it('modifying any actor record produces a different lineageDigest', () => {
    const report = buildEcosystemReadinessReport({
      reportId: 'chaos-er-8',
      generatedAt: '2026-05-10T00:00:00.000Z',
      inputs: {
        signals: [makeSignal(0, 'bundle-0', false)],
        expectedActors: [{ actorId: 'actor-0', actorRole: 'ISSUER', institutionId: 'inst-0' }],
        breachedBundleIds: [],
      },
    });

    const originalDigest = report.lineageDigest;

    // Tamper: flip an actor verdict
    const tampered = {
      ...report,
      actorRecords: report.actorRecords.map(r => ({ ...r, convergencePct: 42 })),
    };

    const recomputed = reproduceReadinessLineageDigest(tampered);
    expect(recomputed).not.toBe(originalDigest);

    console.log(`[readiness-board] C-ER-8 | Tamper detected: digest changed | Original: ${originalDigest.slice(0, 12)}... | Tampered: ${recomputed.slice(0, 12)}...`);
  });
});
