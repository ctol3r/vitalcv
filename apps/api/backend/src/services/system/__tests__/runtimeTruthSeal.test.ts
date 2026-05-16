import {
  buildRuntimeTruthSealLineage,
  evaluateRuntimeTruthSeal,
  evaluateRuntimeTruthSealGate,
  runRuntimeTruthSealChaosSimulations,
  type RuntimeTruthSealEvidence,
} from '../runtimeTruthSeal';

const SEAL_ID = 'runtime-truth-seal-161a';
const GENERATED_AT = '2026-05-11T01:10:00.000Z';

function evidence(
  overrides: Partial<RuntimeTruthSealEvidence> = {},
): RuntimeTruthSealEvidence {
  return {
    evidenceId: 'truth-evidence-global-1',
    recordedAt: '2026-05-11T00:00:00.000Z',
    domain: 'global_truth_verification',
    sourceSystemId: 'runtime-truth-verifier',
    replayTraceId: 'truth-replay-1',
    truthFidelity: 0.92,
    replayFaithfulness: 0.91,
    ambiguityPermanence: 0.9,
    driftPrevention: 0.91,
    runtimeStability: 0.9,
    longitudinalDurability: 0.9,
    sealed: true,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['truth-evidence-1', 'truth-gate-1'],
    lineageRefs: ['truth-lineage-1', 'decision-capsule-1'],
    ambiguityRefs: ['ambiguity-trace-1'],
    telemetryRefs: ['truth-telemetry-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeTruthSealEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'truth-evidence-replay-1',
      recordedAt: '2026-05-11T00:08:00.000Z',
      domain: 'replay_truth_immutability',
      sourceSystemId: 'replay-truth-lock',
      replayTraceId: 'truth-replay-2',
      truthFidelity: 0.91,
      replayFaithfulness: 0.92,
      ambiguityPermanence: 0.9,
      driftPrevention: 0.9,
      runtimeStability: 0.9,
      longitudinalDurability: 0.9,
      evidenceRefs: ['replay-truth-evidence-1', 'replay-lock-1'],
      lineageRefs: ['replay-truth-lineage-1', 'replay-capsule-1'],
      ambiguityRefs: ['ambiguity-trace-2'],
      telemetryRefs: ['truth-telemetry-2'],
    }),
    evidence({
      evidenceId: 'truth-evidence-ambiguity-1',
      recordedAt: '2026-05-11T00:16:00.000Z',
      domain: 'ambiguity_permanence',
      sourceSystemId: 'ambiguity-permanence-lock',
      replayTraceId: 'truth-replay-3',
      truthFidelity: 0.9,
      replayFaithfulness: 0.9,
      ambiguityPermanence: 0.93,
      driftPrevention: 0.89,
      runtimeStability: 0.9,
      longitudinalDurability: 0.9,
      evidenceRefs: ['ambiguity-evidence-1', 'ambiguity-policy-1'],
      lineageRefs: ['ambiguity-lineage-1', 'ambiguity-capsule-1'],
      ambiguityRefs: ['ambiguity-trace-3', 'ambiguity-retention-1'],
      telemetryRefs: ['truth-telemetry-3'],
      ambiguity: 'Verifier confidence interval remains ambiguous after remote replay seal.',
    }),
    evidence({
      evidenceId: 'truth-evidence-telemetry-1',
      recordedAt: '2026-05-11T00:24:00.000Z',
      domain: 'truth_telemetry_lock',
      sourceSystemId: 'truth-telemetry-lock',
      replayTraceId: 'truth-replay-4',
      truthFidelity: 0.9,
      replayFaithfulness: 0.9,
      ambiguityPermanence: 0.9,
      driftPrevention: 0.91,
      runtimeStability: 0.92,
      longitudinalDurability: 0.91,
      evidenceRefs: ['telemetry-evidence-1', 'telemetry-lock-1'],
      lineageRefs: ['telemetry-lineage-1', 'telemetry-capsule-1'],
      ambiguityRefs: ['ambiguity-trace-4'],
      telemetryRefs: ['truth-telemetry-4', 'telemetry-lock-proof-1'],
    }),
    evidence({
      evidenceId: 'truth-evidence-drift-1',
      recordedAt: '2026-05-11T00:32:00.000Z',
      domain: 'truth_drift_prevention',
      sourceSystemId: 'truth-drift-lock',
      replayTraceId: 'truth-replay-5',
      truthFidelity: 0.9,
      replayFaithfulness: 0.9,
      ambiguityPermanence: 0.9,
      driftPrevention: 0.93,
      runtimeStability: 0.91,
      longitudinalDurability: 0.91,
      evidenceRefs: ['drift-evidence-1', 'drift-sentinel-1'],
      lineageRefs: ['drift-lineage-1', 'drift-capsule-1'],
      ambiguityRefs: ['ambiguity-trace-5'],
      telemetryRefs: ['truth-telemetry-5'],
    }),
    evidence({
      evidenceId: 'truth-evidence-lineage-1',
      recordedAt: '2026-05-11T00:40:00.000Z',
      domain: 'runtime_truth_lineage',
      sourceSystemId: 'truth-lineage-lock',
      replayTraceId: 'truth-replay-6',
      truthFidelity: 0.91,
      replayFaithfulness: 0.9,
      ambiguityPermanence: 0.9,
      driftPrevention: 0.9,
      runtimeStability: 0.9,
      longitudinalDurability: 0.9,
      evidenceRefs: ['lineage-evidence-1', 'truth-chain-1'],
      lineageRefs: ['lineage-node-1', 'lineage-node-2'],
      ambiguityRefs: ['ambiguity-trace-6'],
      telemetryRefs: ['truth-telemetry-6'],
    }),
    evidence({
      evidenceId: 'truth-evidence-durable-1',
      recordedAt: '2026-05-11T00:48:00.000Z',
      domain: 'longitudinal_truth_durability',
      sourceSystemId: 'truth-durability-lock',
      replayTraceId: 'truth-replay-7',
      truthFidelity: 0.9,
      replayFaithfulness: 0.9,
      ambiguityPermanence: 0.9,
      driftPrevention: 0.9,
      runtimeStability: 0.91,
      longitudinalDurability: 0.93,
      evidenceRefs: ['durability-evidence-1', 'durability-snapshot-1'],
      lineageRefs: ['durability-lineage-1', 'durability-capsule-1'],
      ambiguityRefs: ['ambiguity-trace-7'],
      telemetryRefs: ['truth-telemetry-7'],
    }),
  ];
}

describe('W2-PR161A runtime truth seal', () => {
  it('builds deterministic truth-seal lineage from unordered evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeTruthSealLineage({
      sealId: SEAL_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeTruthSealLineage({
      sealId: SEAL_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'truth-evidence-global-1',
      'truth-evidence-replay-1',
      'truth-evidence-ambiguity-1',
      'truth-evidence-telemetry-1',
      'truth-evidence-drift-1',
      'truth-evidence-lineage-1',
      'truth-evidence-durable-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'global_truth_verification',
      'replay_truth_immutability',
      'ambiguity_permanence',
      'truth_telemetry_lock',
      'truth_drift_prevention',
      'runtime_truth_lineage',
      'longitudinal_truth_durability',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-11T00:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-11T00:48:00.000Z');
  });

  it('seals replay truth, ambiguity permanence, telemetry locking, and post-seal drift prevention', () => {
    const result = evaluateRuntimeTruthSeal({
      sealId: SEAL_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('RUNTIME_TRUTH_SEAL_DEGRADED');
    expect(result.verdict).toBe('RUNTIME_TRUTH_SEALED_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayTruth.globallyFaithful).toBe(true);
    expect(result.replayTruth.fidelityPct).toBeGreaterThanOrEqual(90);
    expect(result.ambiguityPermanence.permanent).toBe(true);
    expect(result.truthTelemetry.locked).toBe(true);
    expect(result.driftPrevention.impossiblePostSeal).toBe(true);
    expect(result.runtimeTruth.longitudinallyDurable).toBe(true);
    expect(result.ambiguities).toEqual([
      'Verifier confidence interval remains ambiguous after remote replay seal.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'replay_truth_globally_faithful',
      'ambiguity_permanently_preserved',
      'truth_lineage_reconstructable',
      'fail_closed_truth_semantics',
      'drift_impossible_post_seal',
      'truth_telemetry_locked',
      'runtime_truth_longitudinally_durable',
    ]));
  });

  it('fails closed when truth evidence is mutable, ambiguous without permanence, unlocked, or not reconstructable', () => {
    const result = evaluateRuntimeTruthSeal({
      sealId: SEAL_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'truth-evidence-broken-1',
          replayTraceId: null,
          truthFidelity: 0.3,
          replayFaithfulness: 0.25,
          ambiguityPermanence: 0.2,
          driftPrevention: 0.2,
          runtimeStability: 0.2,
          longitudinalDurability: 0.2,
          sealed: false,
          immutable: false,
          failClosedReady: false,
          evidenceRefs: [],
          lineageRefs: [],
          ambiguityRefs: [],
          telemetryRefs: [],
          ambiguity: 'Runtime truth seal omitted ambiguity retention proof.',
        }),
      ],
    });

    expect(result.status).toBe('RUNTIME_TRUTH_SEAL_BLOCKED');
    expect(result.verdict).toBe('RUNTIME_TRUTH_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Replay truth is not globally faithful.',
      'Ambiguity permanence is not enforceable.',
      'Truth lineage is not reconstructable.',
      'Truth telemetry is not locked.',
      'Post-seal drift prevention is not enforceable.',
      'Fail-closed truth semantics are not ready.',
      'Runtime truth is not longitudinally durable.',
    ]));
    expect(result.ambiguities).toEqual([
      'Runtime truth seal omitted ambiguity retention proof.',
    ]);

    const gate = evaluateRuntimeTruthSealGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'replay_truth_globally_faithful',
      'ambiguity_permanently_preserved',
      'truth_lineage_reconstructable',
      'fail_closed_truth_semantics',
      'drift_impossible_post_seal',
      'truth_telemetry_locked',
      'runtime_truth_longitudinally_durable',
    ]));
  });

  it('surfaces every runtime truth-seal chaos scenario without silent normalization', () => {
    const chaos = runRuntimeTruthSealChaosSimulations({
      sealId: SEAL_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(8);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_TRUTH_MUTATION',
      'AMBIGUITY_SUPPRESSION',
      'LINEAGE_GAP',
      'TELEMETRY_UNLOCK',
      'DRIFT_PREVENTION_DROP',
      'FAIL_CLOSED_DISABLED',
      'LONGITUDINAL_DURABILITY_COLLAPSE',
      'CONFIDENCE_INFLATION',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
