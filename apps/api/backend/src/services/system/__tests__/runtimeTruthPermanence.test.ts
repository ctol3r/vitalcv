import {
  buildRuntimeTruthPermanenceLineage,
  evaluateRuntimeTruthPermanence,
  evaluateRuntimeTruthPermanenceGate,
  runRuntimeTruthPermanenceChaosSimulations,
  type RuntimeTruthPermanenceEvidence,
} from '../runtimeTruthPermanence';

const PERMANENCE_ID = 'runtime-truth-permanence-168a';
const GENERATED_AT = '2026-05-11T01:55:00.000Z';

function evidence(
  overrides: Partial<RuntimeTruthPermanenceEvidence> = {},
): RuntimeTruthPermanenceEvidence {
  return {
    evidenceId: 'truth-permanence-freeze-1',
    recordedAt: '2026-05-11T01:00:00.000Z',
    domain: 'post_freeze_truth_verification',
    sourceSystemId: 'post-freeze-truth',
    replayTraceId: 'permanence-replay-1',
    replayFaithfulness: 0.91,
    truthDurability: 0.9,
    ambiguityPermanence: 0.9,
    driftResistance: 0.91,
    runtimeStability: 0.9,
    truthScore: 0.9,
    operationalObservability: 0.9,
    longitudinalDurability: 0.9,
    freezeSealed: true,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: ['truth-freeze-evidence-1'],
    lineageRefs: ['truth-freeze-lineage-1'],
    ambiguityRefs: ['ambiguity-retention-1'],
    driftTelemetryRefs: ['drift-telemetry-1'],
    observabilityRefs: ['truth-observability-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeTruthPermanenceEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'truth-permanence-replay-1',
      recordedAt: '2026-05-11T01:08:00.000Z',
      domain: 'replay_truth_durability',
      sourceSystemId: 'replay-truth-durability',
      replayTraceId: 'permanence-replay-2',
      replayFaithfulness: 0.92,
      truthDurability: 0.92,
      ambiguityPermanence: 0.9,
      driftResistance: 0.9,
      runtimeStability: 0.9,
      truthScore: 0.9,
      operationalObservability: 0.9,
      longitudinalDurability: 0.91,
      evidenceRefs: ['replay-durability-evidence-1'],
      lineageRefs: ['replay-durability-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-2'],
      driftTelemetryRefs: ['drift-telemetry-2'],
      observabilityRefs: ['replay-observability-1'],
    }),
    evidence({
      evidenceId: 'truth-permanence-ambiguity-1',
      recordedAt: '2026-05-11T01:16:00.000Z',
      domain: 'ambiguity_permanence_validation',
      sourceSystemId: 'ambiguity-permanence-validator',
      replayTraceId: 'permanence-replay-3',
      replayFaithfulness: 0.9,
      truthDurability: 0.9,
      ambiguityPermanence: 0.93,
      driftResistance: 0.9,
      runtimeStability: 0.9,
      truthScore: 0.9,
      operationalObservability: 0.9,
      longitudinalDurability: 0.9,
      evidenceRefs: ['ambiguity-evidence-1'],
      lineageRefs: ['ambiguity-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-3', 'ambiguity-proof-1'],
      driftTelemetryRefs: ['drift-telemetry-3'],
      observabilityRefs: ['ambiguity-observability-1'],
      ambiguity: 'Remote verifier confidence remains interval-bound after runtime freeze.',
    }),
    evidence({
      evidenceId: 'truth-permanence-drift-1',
      recordedAt: '2026-05-11T01:24:00.000Z',
      domain: 'truth_drift_telemetry',
      sourceSystemId: 'truth-drift-telemetry',
      replayTraceId: 'permanence-replay-4',
      replayFaithfulness: 0.9,
      truthDurability: 0.9,
      ambiguityPermanence: 0.9,
      driftResistance: 0.93,
      runtimeStability: 0.91,
      truthScore: 0.9,
      operationalObservability: 0.91,
      longitudinalDurability: 0.91,
      evidenceRefs: ['drift-evidence-1'],
      lineageRefs: ['drift-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-4'],
      driftTelemetryRefs: ['drift-telemetry-4', 'drift-sentinel-1'],
      observabilityRefs: ['drift-observability-1'],
    }),
    evidence({
      evidenceId: 'truth-permanence-score-1',
      recordedAt: '2026-05-11T01:32:00.000Z',
      domain: 'runtime_truth_scoring',
      sourceSystemId: 'runtime-truth-score',
      replayTraceId: 'permanence-replay-5',
      replayFaithfulness: 0.9,
      truthDurability: 0.9,
      ambiguityPermanence: 0.9,
      driftResistance: 0.9,
      runtimeStability: 0.9,
      truthScore: 0.92,
      operationalObservability: 0.9,
      longitudinalDurability: 0.9,
      evidenceRefs: ['score-evidence-1', 'score-inputs-1'],
      lineageRefs: ['score-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-5'],
      driftTelemetryRefs: ['drift-telemetry-5'],
      observabilityRefs: ['score-observability-1'],
    }),
    evidence({
      evidenceId: 'truth-permanence-observable-1',
      recordedAt: '2026-05-11T01:40:00.000Z',
      domain: 'institutional_truth_observability',
      sourceSystemId: 'institutional-truth-observability',
      replayTraceId: 'permanence-replay-6',
      replayFaithfulness: 0.9,
      truthDurability: 0.9,
      ambiguityPermanence: 0.9,
      driftResistance: 0.9,
      runtimeStability: 0.91,
      truthScore: 0.9,
      operationalObservability: 0.93,
      longitudinalDurability: 0.91,
      evidenceRefs: ['observability-evidence-1'],
      lineageRefs: ['observability-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-6'],
      driftTelemetryRefs: ['drift-telemetry-6'],
      observabilityRefs: ['operator-panel-1', 'truth-telemetry-view-1'],
    }),
    evidence({
      evidenceId: 'truth-permanence-longitudinal-1',
      recordedAt: '2026-05-11T01:48:00.000Z',
      domain: 'longitudinal_truth_durability',
      sourceSystemId: 'truth-longitudinal',
      replayTraceId: 'permanence-replay-7',
      replayFaithfulness: 0.9,
      truthDurability: 0.91,
      ambiguityPermanence: 0.9,
      driftResistance: 0.9,
      runtimeStability: 0.91,
      truthScore: 0.9,
      operationalObservability: 0.91,
      longitudinalDurability: 0.93,
      evidenceRefs: ['longitudinal-evidence-1'],
      lineageRefs: ['longitudinal-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-7'],
      driftTelemetryRefs: ['drift-telemetry-7'],
      observabilityRefs: ['longitudinal-observability-1'],
    }),
  ];
}

describe('W2-PR168A runtime truth permanence verification', () => {
  it('builds deterministic truth permanence lineage from unordered post-freeze evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeTruthPermanenceLineage({
      permanenceId: PERMANENCE_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeTruthPermanenceLineage({
      permanenceId: PERMANENCE_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'truth-permanence-freeze-1',
      'truth-permanence-replay-1',
      'truth-permanence-ambiguity-1',
      'truth-permanence-drift-1',
      'truth-permanence-score-1',
      'truth-permanence-observable-1',
      'truth-permanence-longitudinal-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'post_freeze_truth_verification',
      'replay_truth_durability',
      'ambiguity_permanence_validation',
      'truth_drift_telemetry',
      'runtime_truth_scoring',
      'institutional_truth_observability',
      'longitudinal_truth_durability',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-11T01:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-11T01:48:00.000Z');
  });

  it('verifies post-freeze truth permanence, replay durability, ambiguity permanence, drift telemetry, and observability', () => {
    const result = evaluateRuntimeTruthPermanence({
      permanenceId: PERMANENCE_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('TRUTH_PERMANENCE_DEGRADED');
    expect(result.verdict).toBe('TRUTH_PERMANENCE_VERIFIED_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayTruth.globallyFaithful).toBe(true);
    expect(result.replayTruth.durabilityPct).toBeGreaterThanOrEqual(90);
    expect(result.ambiguityPermanence.permanent).toBe(true);
    expect(result.driftResistance.impossiblePostFreeze).toBe(true);
    expect(result.runtimeTruth.longitudinallyDurable).toBe(true);
    expect(result.institutionalTruth.operationallyObservable).toBe(true);
    expect(result.ambiguities).toEqual([
      'Remote verifier confidence remains interval-bound after runtime freeze.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'truth_globally_replay_faithful',
      'ambiguity_permanently_preserved',
      'drift_impossible_post_freeze',
      'fail_closed_truth_semantics',
      'runtime_truth_longitudinally_durable',
      'institutional_truth_operationally_observable',
      'truth_scoring_evidence_derived',
    ]));
  });

  it('fails closed when post-freeze truth evidence is mutable, unobservable, driftable, or not replay-faithful', () => {
    const result = evaluateRuntimeTruthPermanence({
      permanenceId: PERMANENCE_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'truth-permanence-broken-1',
          replayTraceId: null,
          replayFaithfulness: 0.2,
          truthDurability: 0.2,
          ambiguityPermanence: 0.2,
          driftResistance: 0.2,
          runtimeStability: 0.2,
          truthScore: 0.2,
          operationalObservability: 0.2,
          longitudinalDurability: 0.2,
          freezeSealed: false,
          immutable: false,
          failClosedReady: false,
          evidenceRefs: [],
          lineageRefs: [],
          ambiguityRefs: [],
          driftTelemetryRefs: [],
          observabilityRefs: [],
          ambiguity: 'Post-freeze truth packet omitted retained ambiguity interval.',
        }),
      ],
    });

    expect(result.status).toBe('TRUTH_PERMANENCE_BLOCKED');
    expect(result.verdict).toBe('TRUTH_PERMANENCE_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Truth is not globally replay-faithful.',
      'Ambiguity is not permanently preserved.',
      'Truth drift remains possible post-freeze.',
      'Fail-closed truth semantics are not ready.',
      'Runtime truth is not longitudinally durable.',
      'Institutional truth is not operationally observable.',
      'Truth scoring is not evidence-derived.',
    ]));

    const gate = evaluateRuntimeTruthPermanenceGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'truth_globally_replay_faithful',
      'ambiguity_permanently_preserved',
      'drift_impossible_post_freeze',
      'fail_closed_truth_semantics',
      'runtime_truth_longitudinally_durable',
      'institutional_truth_operationally_observable',
      'truth_scoring_evidence_derived',
    ]));
  });

  it('surfaces every truth permanence chaos scenario without silent normalization', () => {
    const chaos = runRuntimeTruthPermanenceChaosSimulations({
      permanenceId: PERMANENCE_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(8);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_DURABILITY_DROP',
      'AMBIGUITY_SUPPRESSION',
      'DRIFT_TELEMETRY_DROP',
      'POST_FREEZE_MUTATION',
      'OBSERVABILITY_DROP',
      'SCORING_EVIDENCE_GAP',
      'FAIL_CLOSED_DISABLED',
      'LONGITUDINAL_DURABILITY_COLLAPSE',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
