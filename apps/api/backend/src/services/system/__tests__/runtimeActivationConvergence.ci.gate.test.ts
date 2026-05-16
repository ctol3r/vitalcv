import {
  RUNTIME_ACTIVATION_GATE_IDS,
  RUNTIME_ACTIVATION_SENTINELS,
  evaluateRuntimeActivationConvergence,
  evaluateRuntimeActivationGate,
  type RuntimeActivationEvidence,
} from '../runtimeActivationConvergence';

const evidence: RuntimeActivationEvidence[] = [
  {
    evidenceId: 'ci-freeze',
    recordedAt: '2026-05-10T20:00:00.000Z',
    domain: 'runtime_freeze_integrity',
    sourceSystemId: 'ci-freeze',
    replayTraceId: 'ci-replay-1',
    replayIntegrity: 0.93,
    runtimeActivation: 0.91,
    institutionalSurvivability: 0.9,
    ecosystemTrustActivation: 0.9,
    ambiguityHonesty: 0.92,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-freeze-proof', 'ci-runtime-snapshot'],
    lineageRefs: ['ci-freeze-lineage', 'ci-activation-capsule'],
    ambiguity: null,
  },
  {
    evidenceId: 'ci-readiness',
    recordedAt: '2026-05-10T20:08:00.000Z',
    domain: 'institutional_activation_readiness',
    sourceSystemId: 'ci-readiness',
    replayTraceId: 'ci-replay-2',
    replayIntegrity: 0.91,
    runtimeActivation: 0.92,
    institutionalSurvivability: 0.91,
    ecosystemTrustActivation: 0.91,
    ambiguityHonesty: 0.91,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-readiness-score', 'ci-institutional-gate'],
    lineageRefs: ['ci-readiness-lineage', 'ci-activation-route'],
    ambiguity: 'CI readiness preserves one policy mapping ambiguity.',
  },
  {
    evidenceId: 'ci-ledger',
    recordedAt: '2026-05-10T20:16:00.000Z',
    domain: 'replay_ledger_durability',
    sourceSystemId: 'ci-ledger',
    replayTraceId: 'ci-replay-3',
    replayIntegrity: 0.94,
    runtimeActivation: 0.91,
    institutionalSurvivability: 0.91,
    ecosystemTrustActivation: 0.91,
    ambiguityHonesty: 0.93,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-ledger-anchor', 'ci-continuity-proof'],
    lineageRefs: ['ci-ledger-lineage', 'ci-replay-anchor'],
    ambiguity: null,
  },
  {
    evidenceId: 'ci-ignition',
    recordedAt: '2026-05-10T20:24:00.000Z',
    domain: 'ecosystem_ignition',
    sourceSystemId: 'ci-ignition',
    replayTraceId: 'ci-replay-4',
    replayIntegrity: 0.92,
    runtimeActivation: 0.93,
    institutionalSurvivability: 0.92,
    ecosystemTrustActivation: 0.93,
    ambiguityHonesty: 0.92,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-ignition-snapshot', 'ci-participant-cohort'],
    lineageRefs: ['ci-ignition-lineage', 'ci-ecosystem-route'],
    ambiguity: null,
  },
  {
    evidenceId: 'ci-governance',
    recordedAt: '2026-05-10T20:32:00.000Z',
    domain: 'governance_immutability',
    sourceSystemId: 'ci-governance',
    replayTraceId: 'ci-replay-5',
    replayIntegrity: 0.93,
    runtimeActivation: 0.92,
    institutionalSurvivability: 0.92,
    ecosystemTrustActivation: 0.92,
    ambiguityHonesty: 0.93,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-governance-lock', 'ci-doctrine-digest'],
    lineageRefs: ['ci-governance-lineage', 'ci-lock-route'],
    ambiguity: null,
  },
  {
    evidenceId: 'ci-stewardship',
    recordedAt: '2026-05-10T20:40:00.000Z',
    domain: 'stewardship_continuity',
    sourceSystemId: 'ci-stewardship',
    replayTraceId: 'ci-replay-6',
    replayIntegrity: 0.91,
    runtimeActivation: 0.91,
    institutionalSurvivability: 0.93,
    ecosystemTrustActivation: 0.92,
    ambiguityHonesty: 0.92,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-caretaker-lineage', 'ci-succession-plan'],
    lineageRefs: ['ci-stewardship-lineage', 'ci-continuity-route'],
    ambiguity: null,
  },
  {
    evidenceId: 'ci-truth',
    recordedAt: '2026-05-10T20:48:00.000Z',
    domain: 'runtime_truth_verification',
    sourceSystemId: 'ci-truth',
    replayTraceId: 'ci-replay-7',
    replayIntegrity: 0.94,
    runtimeActivation: 0.93,
    institutionalSurvivability: 0.92,
    ecosystemTrustActivation: 0.92,
    ambiguityHonesty: 0.94,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['ci-truth-snapshot', 'ci-drift-resistance'],
    lineageRefs: ['ci-truth-lineage', 'ci-verification-route'],
    ambiguity: null,
  },
];

describe('CI gate - runtime activation convergence', () => {
  it('keeps the runtime-activation gate id surface explicit and frozen', () => {
    expect(RUNTIME_ACTIVATION_GATE_IDS).toEqual([
      'replay_integrity_globally_immutable',
      'ambiguity_honesty_permanently_durable',
      'institutional_activation_survivable',
      'fail_closed_runtime_semantics',
      'ecosystem_trust_longitudinally_measurable',
      'runtime_activation_evidence_derived',
      'runtime_activation_lineage_reconstructable',
    ]);
    expect(Object.isFrozen(RUNTIME_ACTIVATION_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(RUNTIME_ACTIVATION_SENTINELS)).toBe(true);
  });

  it('passes only when replay, ambiguity, survivability, fail-closed, ecosystem, evidence, and lineage gates hold', () => {
    const result = evaluateRuntimeActivationConvergence({
      activationId: 'ci-runtime-activation',
      generatedAt: '2026-05-11T00:30:00.000Z',
      evidence,
    });
    const gate = evaluateRuntimeActivationGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateResult: { id: string }) => gateResult.id)).toEqual(RUNTIME_ACTIVATION_GATE_IDS);
  });
});
