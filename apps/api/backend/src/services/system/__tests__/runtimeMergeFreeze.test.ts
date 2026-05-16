import {
  buildRuntimeMergeFreezeLineage,
  evaluateRuntimeMergeFreeze,
  evaluateRuntimeMergeFreezeGate,
  runRuntimeMergeFreezeChaosSimulations,
  type RuntimeMergeFreezeEvidence,
} from '../runtimeMergeFreeze';

const FREEZE_ID = 'runtime-merge-freeze-189a';
const GENERATED_AT = '2026-05-11T12:00:00.000Z';

function evidence(overrides: Partial<RuntimeMergeFreezeEvidence> = {}): RuntimeMergeFreezeEvidence {
  return {
    evidenceId: 'freeze-merge-state-1',
    recordedAt: '2026-05-11T11:00:00.000Z',
    domain: 'merge_freeze_verification',
    sourceSystemId: 'merge-freeze',
    replayTraceId: 'replay-freeze-1',
    freezeIntegrity: 0.94,
    replayFreezeIntegrity: 0.93,
    governanceImmutability: 0.92,
    driftResistance: 0.91,
    runtimeContinuity: 0.9,
    ambiguityPermanence: 0.92,
    immutablePostFreeze: true,
    governanceLocked: true,
    failClosedReady: true,
    mergeLineageRefs: ['merge-lineage-1', 'freeze-capsule-1'],
    replayFreezeRefs: ['replay-freeze-anchor-1', 'replay-hash-1'],
    governanceRefs: ['governance-lock-1', 'doctrine-digest-1'],
    telemetryRefs: ['freeze-telemetry-1', 'runtime-continuity-1'],
    driftRefs: ['drift-score-1', 'runtime-drift-boundary-1'],
    ambiguityRefs: ['ambiguity-permanence-1'],
    stewardshipRefs: ['stewardship-enforcement-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeMergeFreezeEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'freeze-replay-1',
      recordedAt: '2026-05-11T11:08:00.000Z',
      domain: 'replay_freeze_harmonization',
      sourceSystemId: 'replay-freeze',
      replayTraceId: 'replay-freeze-2',
      freezeIntegrity: 0.93,
      replayFreezeIntegrity: 0.94,
      governanceImmutability: 0.91,
      driftResistance: 0.9,
      runtimeContinuity: 0.91,
      ambiguityPermanence: 0.92,
      mergeLineageRefs: ['replay-merge-lineage-1'],
      replayFreezeRefs: ['replay-freeze-anchor-2', 'replay-ledger-finalization-1'],
      governanceRefs: ['governance-replay-lock-1'],
      telemetryRefs: ['replay-freeze-telemetry-1'],
      driftRefs: ['replay-drift-score-1'],
      stewardshipRefs: ['stewardship-replay-proof-1'],
    }),
    evidence({
      evidenceId: 'freeze-governance-1',
      recordedAt: '2026-05-11T11:16:00.000Z',
      domain: 'governance_immutability_validation',
      sourceSystemId: 'governance-lock',
      replayTraceId: 'replay-freeze-3',
      governanceImmutability: 0.95,
      driftResistance: 0.93,
      mergeLineageRefs: ['governance-merge-lineage-1'],
      governanceRefs: ['runtime-governance-lock-1', 'constitutional-doctrine-digest-1'],
      telemetryRefs: ['governance-freeze-telemetry-1'],
      driftRefs: ['governance-drift-score-1'],
      ambiguityRefs: ['governance-counter-signature-ambiguity-1'],
      stewardshipRefs: ['stewardship-governance-proof-1'],
      ambiguity: 'Governance lock preserves pending institutional counter-signature ambiguity.',
    }),
    evidence({
      evidenceId: 'freeze-telemetry-1',
      recordedAt: '2026-05-11T11:24:00.000Z',
      domain: 'freeze_telemetry',
      sourceSystemId: 'freeze-telemetry',
      replayTraceId: 'replay-freeze-4',
      mergeLineageRefs: ['telemetry-merge-lineage-1'],
      replayFreezeRefs: ['telemetry-replay-freeze-1'],
      governanceRefs: ['telemetry-governance-lock-1'],
      telemetryRefs: ['freeze-telemetry-stream-1', 'runtime-continuity-stream-1'],
      driftRefs: ['telemetry-drift-signal-1'],
      ambiguityRefs: ['telemetry-ambiguity-preservation-1'],
      stewardshipRefs: ['stewardship-telemetry-proof-1'],
    }),
    evidence({
      evidenceId: 'freeze-drift-1',
      recordedAt: '2026-05-11T11:32:00.000Z',
      domain: 'runtime_drift_scoring',
      sourceSystemId: 'runtime-drift',
      replayTraceId: 'replay-freeze-5',
      freezeIntegrity: 0.92,
      replayFreezeIntegrity: 0.92,
      governanceImmutability: 0.93,
      driftResistance: 0.94,
      runtimeContinuity: 0.91,
      mergeLineageRefs: ['drift-merge-lineage-1'],
      replayFreezeRefs: ['drift-replay-freeze-1'],
      governanceRefs: ['drift-governance-lock-1'],
      telemetryRefs: ['drift-telemetry-1'],
      driftRefs: ['runtime-drift-score-1', 'post-freeze-drift-boundary-1'],
      stewardshipRefs: ['stewardship-drift-proof-1'],
    }),
    evidence({
      evidenceId: 'freeze-stewardship-1',
      recordedAt: '2026-05-11T11:40:00.000Z',
      domain: 'stewardship_enforcement',
      sourceSystemId: 'runtime-stewardship',
      replayTraceId: 'replay-freeze-6',
      runtimeContinuity: 0.93,
      mergeLineageRefs: ['stewardship-merge-lineage-1'],
      replayFreezeRefs: ['stewardship-replay-freeze-1'],
      governanceRefs: ['stewardship-governance-lock-1'],
      telemetryRefs: ['stewardship-telemetry-1'],
      driftRefs: ['stewardship-drift-score-1'],
      stewardshipRefs: ['caretaker-continuity-1', 'succession-enforcement-1'],
    }),
    evidence({
      evidenceId: 'freeze-lineage-1',
      recordedAt: '2026-05-11T11:48:00.000Z',
      domain: 'merge_lineage_reconstruction',
      sourceSystemId: 'merge-lineage',
      replayTraceId: 'replay-freeze-7',
      freezeIntegrity: 0.94,
      replayFreezeIntegrity: 0.93,
      governanceImmutability: 0.94,
      driftResistance: 0.92,
      runtimeContinuity: 0.92,
      mergeLineageRefs: ['merge-lineage-root-1', 'post-freeze-route-1'],
      replayFreezeRefs: ['lineage-replay-freeze-1'],
      governanceRefs: ['lineage-governance-lock-1'],
      telemetryRefs: ['lineage-telemetry-1'],
      driftRefs: ['lineage-drift-score-1'],
      stewardshipRefs: ['lineage-stewardship-proof-1'],
    }),
  ];
}

describe('W3-PR189A runtime merge freeze', () => {
  it('builds deterministic merge-freeze lineage from unordered freeze evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeMergeFreezeLineage({
      freezeId: FREEZE_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeMergeFreezeLineage({
      freezeId: FREEZE_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'freeze-merge-state-1',
      'freeze-replay-1',
      'freeze-governance-1',
      'freeze-telemetry-1',
      'freeze-drift-1',
      'freeze-stewardship-1',
      'freeze-lineage-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'freeze_telemetry',
      'governance_immutability_validation',
      'merge_freeze_verification',
      'merge_lineage_reconstruction',
      'replay_freeze_harmonization',
      'runtime_drift_scoring',
      'stewardship_enforcement',
    ]);
  });

  it('freezes runtime merge state while preserving replay, governance, ambiguity, and continuity evidence', () => {
    const result = evaluateRuntimeMergeFreeze({
      freezeId: FREEZE_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('RUNTIME_MERGE_FREEZE_DEGRADED');
    expect(result.verdict).toBe('CONSTITUTIONAL_RUNTIME_MERGE_FROZEN_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayFreeze.immutablePostFreeze).toBe(true);
    expect(result.replayFreeze.integrityPct).toBeGreaterThanOrEqual(92);
    expect(result.governance.immutabilityPct).toBeGreaterThanOrEqual(92);
    expect(result.governance.driftImpossible).toBe(true);
    expect(result.driftResistance.resistancePct).toBeGreaterThanOrEqual(91);
    expect(result.runtimeContinuity.measurable).toBe(true);
    expect(result.ambiguityPermanence.preserved).toBe(true);
    expect(result.mergeLineage.reconstructable).toBe(true);
    expect(result.ambiguities).toEqual([
      'Governance lock preserves pending institutional counter-signature ambiguity.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'merge_freeze_verified',
      'replay_integrity_immutable_post_freeze',
      'governance_drift_impossible',
      'ambiguity_permanence_preserved',
      'runtime_continuity_measurable',
      'merge_lineage_reconstructable',
    ]));
  });

  it('fails closed when replay, governance, lineage, drift, continuity, and ambiguity freeze evidence collapse', () => {
    const result = evaluateRuntimeMergeFreeze({
      freezeId: FREEZE_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'freeze-broken-1',
          replayTraceId: null,
          freezeIntegrity: 0.2,
          replayFreezeIntegrity: 0.18,
          governanceImmutability: 0.15,
          driftResistance: 0.12,
          runtimeContinuity: 0.14,
          ambiguityPermanence: 0.1,
          immutablePostFreeze: false,
          governanceLocked: false,
          failClosedReady: false,
          mergeLineageRefs: [],
          replayFreezeRefs: [],
          governanceRefs: [],
          telemetryRefs: [],
          driftRefs: [],
          ambiguityRefs: [],
          stewardshipRefs: [],
          ambiguity: 'Freeze source omitted replay-governance lock evidence.',
        }),
      ],
    });

    expect(result.status).toBe('RUNTIME_MERGE_FREEZE_BLOCKED');
    expect(result.verdict).toBe('CONSTITUTIONAL_RUNTIME_MERGE_FREEZE_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Merge freeze verification is incomplete.',
      'Replay integrity is not immutable post-freeze.',
      'Governance drift is still possible.',
      'Ambiguity permanence is not preserved.',
      'Runtime continuity is not measurable.',
      'Merge lineage is not reconstructable.',
    ]));
    expect(result.ambiguities).toEqual(['Freeze source omitted replay-governance lock evidence.']);

    const gate = evaluateRuntimeMergeFreezeGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'merge_freeze_verified',
      'replay_integrity_immutable_post_freeze',
      'governance_drift_impossible',
      'ambiguity_permanence_preserved',
      'runtime_continuity_measurable',
      'merge_lineage_reconstructable',
    ]));
  });

  it('surfaces every merge-freeze chaos scenario without silent normalization', () => {
    const chaos = runRuntimeMergeFreezeChaosSimulations({
      freezeId: FREEZE_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(8);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'MERGE_FREEZE_VERIFICATION_DROP',
      'REPLAY_FREEZE_MUTATION',
      'GOVERNANCE_DRIFT_UNLOCK',
      'AMBIGUITY_SUPPRESSION',
      'TELEMETRY_DROP',
      'DRIFT_SCORE_COLLAPSE',
      'FAIL_CLOSED_DISABLED',
      'LINEAGE_GAP',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
