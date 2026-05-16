import {
  buildRuntimeActivationLineage,
  evaluateRuntimeActivationConvergence,
  evaluateRuntimeActivationGate,
  runRuntimeActivationChaosSimulations,
  type RuntimeActivationEvidence,
} from '../runtimeActivationConvergence';

const ACTIVATION_ID = 'runtime-activation-152a';
const GENERATED_AT = '2026-05-11T00:30:00.000Z';

function evidence(overrides: Partial<RuntimeActivationEvidence> = {}): RuntimeActivationEvidence {
  return {
    evidenceId: 'evidence-runtime-freeze-1',
    recordedAt: '2026-05-10T20:00:00.000Z',
    domain: 'runtime_freeze_integrity',
    sourceSystemId: 'runtime-freeze',
    replayTraceId: 'replay-trace-1',
    replayIntegrity: 0.92,
    runtimeActivation: 0.9,
    institutionalSurvivability: 0.88,
    ecosystemTrustActivation: 0.87,
    ambiguityHonesty: 0.91,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['freeze-proof-1', 'runtime-snapshot-1'],
    lineageRefs: ['freeze-lineage-1', 'activation-capsule-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeActivationEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'evidence-activation-readiness-1',
      recordedAt: '2026-05-10T20:08:00.000Z',
      domain: 'institutional_activation_readiness',
      sourceSystemId: 'activation-readiness',
      replayTraceId: 'replay-trace-2',
      replayIntegrity: 0.9,
      runtimeActivation: 0.91,
      institutionalSurvivability: 0.89,
      ecosystemTrustActivation: 0.88,
      ambiguityHonesty: 0.9,
      evidenceRefs: ['readiness-score-1', 'institutional-gate-1'],
      lineageRefs: ['readiness-lineage-1', 'activation-route-1'],
    }),
    evidence({
      evidenceId: 'evidence-replay-ledger-1',
      recordedAt: '2026-05-10T20:16:00.000Z',
      domain: 'replay_ledger_durability',
      sourceSystemId: 'replay-ledger',
      replayTraceId: 'replay-trace-3',
      replayIntegrity: 0.93,
      runtimeActivation: 0.9,
      institutionalSurvivability: 0.9,
      ecosystemTrustActivation: 0.89,
      ambiguityHonesty: 0.91,
      evidenceRefs: ['ledger-anchor-1', 'continuity-proof-1'],
      lineageRefs: ['ledger-lineage-1', 'replay-anchor-1'],
      ambiguity: 'Replay ledger preserves remote-anchor confirmation lag.',
    }),
    evidence({
      evidenceId: 'evidence-ecosystem-ignition-1',
      recordedAt: '2026-05-10T20:24:00.000Z',
      domain: 'ecosystem_ignition',
      sourceSystemId: 'ecosystem-ignition',
      replayTraceId: 'replay-trace-4',
      replayIntegrity: 0.91,
      runtimeActivation: 0.92,
      institutionalSurvivability: 0.91,
      ecosystemTrustActivation: 0.92,
      ambiguityHonesty: 0.9,
      evidenceRefs: ['ignition-snapshot-1', 'participant-cohort-1'],
      lineageRefs: ['ignition-lineage-1', 'ecosystem-route-1'],
    }),
    evidence({
      evidenceId: 'evidence-governance-lock-1',
      recordedAt: '2026-05-10T20:32:00.000Z',
      domain: 'governance_immutability',
      sourceSystemId: 'governance-lock',
      replayTraceId: 'replay-trace-5',
      replayIntegrity: 0.92,
      runtimeActivation: 0.91,
      institutionalSurvivability: 0.9,
      ecosystemTrustActivation: 0.9,
      ambiguityHonesty: 0.92,
      evidenceRefs: ['governance-lock-1', 'doctrine-digest-1'],
      lineageRefs: ['governance-lineage-1', 'lock-route-1'],
    }),
    evidence({
      evidenceId: 'evidence-stewardship-1',
      recordedAt: '2026-05-10T20:40:00.000Z',
      domain: 'stewardship_continuity',
      sourceSystemId: 'runtime-stewardship',
      replayTraceId: 'replay-trace-6',
      replayIntegrity: 0.9,
      runtimeActivation: 0.9,
      institutionalSurvivability: 0.92,
      ecosystemTrustActivation: 0.91,
      ambiguityHonesty: 0.91,
      evidenceRefs: ['caretaker-lineage-1', 'succession-plan-1'],
      lineageRefs: ['stewardship-lineage-1', 'continuity-route-1'],
    }),
    evidence({
      evidenceId: 'evidence-truth-verification-1',
      recordedAt: '2026-05-10T20:48:00.000Z',
      domain: 'runtime_truth_verification',
      sourceSystemId: 'truth-verification',
      replayTraceId: 'replay-trace-7',
      replayIntegrity: 0.93,
      runtimeActivation: 0.92,
      institutionalSurvivability: 0.91,
      ecosystemTrustActivation: 0.91,
      ambiguityHonesty: 0.93,
      evidenceRefs: ['truth-snapshot-1', 'drift-resistance-1'],
      lineageRefs: ['truth-lineage-1', 'verification-route-1'],
    }),
  ];
}

describe('W2-PR152A runtime activation convergence', () => {
  it('builds deterministic activation lineage from unordered runtime evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeActivationLineage({
      activationId: ACTIVATION_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeActivationLineage({
      activationId: ACTIVATION_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'evidence-runtime-freeze-1',
      'evidence-activation-readiness-1',
      'evidence-replay-ledger-1',
      'evidence-ecosystem-ignition-1',
      'evidence-governance-lock-1',
      'evidence-stewardship-1',
      'evidence-truth-verification-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'ecosystem_ignition',
      'governance_immutability',
      'institutional_activation_readiness',
      'replay_ledger_durability',
      'runtime_freeze_integrity',
      'runtime_truth_verification',
      'stewardship_continuity',
    ]);
  });

  it('synthesizes replay convergence, activation fidelity, survivability, ecosystem trust, and durable ambiguity', () => {
    const result = evaluateRuntimeActivationConvergence({
      activationId: ACTIVATION_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('RUNTIME_ACTIVATION_DEGRADED');
    expect(result.verdict).toBe('CONSTITUTIONAL_RUNTIME_ACTIVATED_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayIntegrity.globallyImmutable).toBe(true);
    expect(result.replayIntegrity.integrityPct).toBeGreaterThanOrEqual(91);
    expect(result.runtimeActivation.evidenceDerived).toBe(true);
    expect(result.institutionalSurvivability.survivable).toBe(true);
    expect(result.ecosystemTrust.longitudinallyMeasurable).toBe(true);
    expect(result.ambiguityHonesty.permanentlyDurable).toBe(true);
    expect(result.ambiguities).toEqual(['Replay ledger preserves remote-anchor confirmation lag.']);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'replay_integrity_globally_immutable',
      'runtime_activation_evidence_derived',
      'institutional_activation_survivable',
      'ambiguity_honesty_permanently_durable',
      'ecosystem_trust_longitudinally_measurable',
    ]));
  });

  it('fails closed when replay, lineage, ambiguity, survivability, and evidence derivation collapse', () => {
    const result = evaluateRuntimeActivationConvergence({
      activationId: ACTIVATION_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'evidence-broken-runtime-1',
          replayTraceId: null,
          replayIntegrity: 0.22,
          runtimeActivation: 0.2,
          institutionalSurvivability: 0.18,
          ecosystemTrustActivation: 0.19,
          ambiguityHonesty: 0.2,
          immutable: false,
          failClosedReady: false,
          evidenceRefs: [],
          lineageRefs: [],
          ambiguity: 'Runtime activation source omitted replay-ledger anchor.',
        }),
      ],
    });

    expect(result.status).toBe('RUNTIME_ACTIVATION_BLOCKED');
    expect(result.verdict).toBe('CONSTITUTIONAL_RUNTIME_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Replay integrity is not globally immutable.',
      'Runtime activation evidence is not derived.',
      'Institutional activation is not survivable.',
      'Ecosystem trust is not longitudinally measurable.',
      'Runtime activation lineage is not reconstructable.',
    ]));
    expect(result.ambiguities).toEqual(['Runtime activation source omitted replay-ledger anchor.']);

    const gate = evaluateRuntimeActivationGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'replay_integrity_globally_immutable',
      'runtime_activation_evidence_derived',
      'institutional_activation_survivable',
      'runtime_activation_lineage_reconstructable',
    ]));
  });

  it('surfaces every runtime-activation chaos scenario without silent normalization', () => {
    const chaos = runRuntimeActivationChaosSimulations({
      activationId: ACTIVATION_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(7);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_IMMUTABILITY_DROP',
      'AMBIGUITY_HONESTY_SUPPRESSION',
      'LINEAGE_GAP',
      'SURVIVABILITY_COLLAPSE',
      'ECOSYSTEM_TRUST_COLLAPSE',
      'FAIL_CLOSED_DISABLED',
      'EVIDENCE_DERIVATION_GAP',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
