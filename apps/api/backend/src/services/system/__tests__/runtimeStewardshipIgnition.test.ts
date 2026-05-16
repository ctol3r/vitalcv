import {
  buildRuntimeStewardshipIgnitionLineage,
  evaluateRuntimeStewardshipIgnition,
  evaluateRuntimeStewardshipIgnitionGate,
  runRuntimeStewardshipIgnitionChaosSimulations,
  type RuntimeStewardshipIgnitionEvidence,
} from '../runtimeStewardshipIgnition';

const IGNITION_ID = 'runtime-stewardship-ignition-171a';
const GENERATED_AT = '2026-05-11T02:20:00.000Z';

function evidence(
  overrides: Partial<RuntimeStewardshipIgnitionEvidence> = {},
): RuntimeStewardshipIgnitionEvidence {
  return {
    evidenceId: 'ignition-workflow-1',
    recordedAt: '2026-05-11T02:00:00.000Z',
    domain: 'stewardship_ignition_workflow',
    sourceSystemId: 'stewardship-ignition',
    replayTraceId: 'ignition-replay-1',
    replayFaithfulness: 0.91,
    governanceContinuity: 0.9,
    institutionalStability: 0.9,
    stewardshipSurvivability: 0.9,
    ignitionReadiness: 0.91,
    caretakerLineageDurability: 0.9,
    operationalStability: 0.9,
    activated: true,
    immutable: true,
    failClosedReady: true,
    workflowRefs: ['ignition-workflow-1'],
    governanceContinuityRefs: ['governance-continuity-1'],
    replayTelemetryRefs: ['replay-telemetry-1'],
    caretakerLineageRefs: ['caretaker-lineage-1'],
    harmonizationRefs: ['caretaker-harmonization-1'],
    survivabilityRefs: ['survivability-score-1'],
    evidenceRefs: ['ignition-evidence-1'],
    ambiguityRefs: ['ambiguity-retention-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeStewardshipIgnitionEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'ignition-governance-continuity-1',
      recordedAt: '2026-05-11T02:08:00.000Z',
      domain: 'governance_continuity_activation',
      sourceSystemId: 'governance-continuity',
      replayTraceId: 'ignition-replay-2',
      replayFaithfulness: 0.9,
      governanceContinuity: 0.92,
      institutionalStability: 0.9,
      stewardshipSurvivability: 0.9,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.9,
      operationalStability: 0.9,
      workflowRefs: ['governance-activation-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-2', 'activation-lock-1'],
      replayTelemetryRefs: ['replay-telemetry-2'],
      caretakerLineageRefs: ['caretaker-lineage-2'],
      harmonizationRefs: ['caretaker-harmonization-2'],
      survivabilityRefs: ['survivability-score-2'],
      evidenceRefs: ['governance-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-2'],
    }),
    evidence({
      evidenceId: 'ignition-replay-telemetry-1',
      recordedAt: '2026-05-11T02:16:00.000Z',
      domain: 'replay_stewardship_telemetry',
      sourceSystemId: 'replay-stewardship-telemetry',
      replayTraceId: 'ignition-replay-3',
      replayFaithfulness: 0.93,
      governanceContinuity: 0.9,
      institutionalStability: 0.9,
      stewardshipSurvivability: 0.9,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.9,
      operationalStability: 0.91,
      workflowRefs: ['replay-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-3'],
      replayTelemetryRefs: ['replay-telemetry-3', 'replay-monitor-1'],
      caretakerLineageRefs: ['caretaker-lineage-3'],
      harmonizationRefs: ['caretaker-harmonization-3'],
      survivabilityRefs: ['survivability-score-3'],
      evidenceRefs: ['replay-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-3'],
    }),
    evidence({
      evidenceId: 'ignition-caretaker-harmonization-1',
      recordedAt: '2026-05-11T02:24:00.000Z',
      domain: 'caretaker_harmonization',
      sourceSystemId: 'caretaker-harmonizer',
      replayTraceId: 'ignition-replay-4',
      replayFaithfulness: 0.9,
      governanceContinuity: 0.9,
      institutionalStability: 0.9,
      stewardshipSurvivability: 0.9,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.93,
      operationalStability: 0.9,
      workflowRefs: ['caretaker-harmonization-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-4'],
      replayTelemetryRefs: ['replay-telemetry-4'],
      caretakerLineageRefs: ['caretaker-lineage-4', 'caretaker-succession-1'],
      harmonizationRefs: ['caretaker-harmonization-4', 'cross-institution-caretaker-map-1'],
      survivabilityRefs: ['survivability-score-4'],
      evidenceRefs: ['caretaker-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-4'],
      ambiguity: 'Secondary caretaker authority remains pending remote institutional confirmation.',
    }),
    evidence({
      evidenceId: 'ignition-survivability-score-1',
      recordedAt: '2026-05-11T02:32:00.000Z',
      domain: 'stewardship_survivability_scoring',
      sourceSystemId: 'stewardship-survivability',
      replayTraceId: 'ignition-replay-5',
      replayFaithfulness: 0.9,
      governanceContinuity: 0.9,
      institutionalStability: 0.91,
      stewardshipSurvivability: 0.93,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.9,
      operationalStability: 0.91,
      workflowRefs: ['survivability-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-5'],
      replayTelemetryRefs: ['replay-telemetry-5'],
      caretakerLineageRefs: ['caretaker-lineage-5'],
      harmonizationRefs: ['caretaker-harmonization-5'],
      survivabilityRefs: ['survivability-score-5', 'chaos-survivability-1'],
      evidenceRefs: ['survivability-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-5'],
    }),
    evidence({
      evidenceId: 'ignition-institutional-stability-1',
      recordedAt: '2026-05-11T02:40:00.000Z',
      domain: 'institutional_stability',
      sourceSystemId: 'institutional-stability',
      replayTraceId: 'ignition-replay-6',
      replayFaithfulness: 0.9,
      governanceContinuity: 0.91,
      institutionalStability: 0.93,
      stewardshipSurvivability: 0.91,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.9,
      operationalStability: 0.92,
      workflowRefs: ['stability-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-6'],
      replayTelemetryRefs: ['replay-telemetry-6'],
      caretakerLineageRefs: ['caretaker-lineage-6'],
      harmonizationRefs: ['caretaker-harmonization-6'],
      survivabilityRefs: ['survivability-score-6'],
      evidenceRefs: ['stability-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-6'],
    }),
    evidence({
      evidenceId: 'ignition-longitudinal-lineage-1',
      recordedAt: '2026-05-11T02:48:00.000Z',
      domain: 'longitudinal_caretaker_lineage',
      sourceSystemId: 'caretaker-lineage-durability',
      replayTraceId: 'ignition-replay-7',
      replayFaithfulness: 0.9,
      governanceContinuity: 0.9,
      institutionalStability: 0.91,
      stewardshipSurvivability: 0.91,
      ignitionReadiness: 0.9,
      caretakerLineageDurability: 0.93,
      operationalStability: 0.91,
      workflowRefs: ['lineage-workflow-1'],
      governanceContinuityRefs: ['governance-continuity-7'],
      replayTelemetryRefs: ['replay-telemetry-7'],
      caretakerLineageRefs: ['caretaker-lineage-7', 'longitudinal-lineage-1'],
      harmonizationRefs: ['caretaker-harmonization-7'],
      survivabilityRefs: ['survivability-score-7'],
      evidenceRefs: ['lineage-evidence-1'],
      ambiguityRefs: ['ambiguity-retention-7'],
    }),
  ];
}

describe('W2-PR171A runtime stewardship ignition', () => {
  it('builds deterministic stewardship ignition lineage from unordered evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeStewardshipIgnitionLineage({
      ignitionId: IGNITION_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeStewardshipIgnitionLineage({
      ignitionId: IGNITION_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'ignition-workflow-1',
      'ignition-governance-continuity-1',
      'ignition-replay-telemetry-1',
      'ignition-caretaker-harmonization-1',
      'ignition-survivability-score-1',
      'ignition-institutional-stability-1',
      'ignition-longitudinal-lineage-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'stewardship_ignition_workflow',
      'governance_continuity_activation',
      'replay_stewardship_telemetry',
      'caretaker_harmonization',
      'stewardship_survivability_scoring',
      'institutional_stability',
      'longitudinal_caretaker_lineage',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-11T02:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-11T02:48:00.000Z');
  });

  it('ignites stewardship with replay telemetry, governance continuity, caretaker harmonization, and survivability scoring', () => {
    const result = evaluateRuntimeStewardshipIgnition({
      ignitionId: IGNITION_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('STEWARDSHIP_IGNITION_DEGRADED');
    expect(result.verdict).toBe('STEWARDSHIP_IGNITED_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayStewardship.faithful).toBe(true);
    expect(result.governanceContinuity.reconstructable).toBe(true);
    expect(result.caretakerHarmonization.longitudinallyDurable).toBe(true);
    expect(result.stewardshipSurvivability.scored).toBe(true);
    expect(result.institutionalStability.stable).toBe(true);
    expect(result.ignition.activated).toBe(true);
    expect(result.ambiguities).toEqual([
      'Secondary caretaker authority remains pending remote institutional confirmation.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'stewardship_replay_faithful',
      'ambiguity_preserved_operationally',
      'governance_continuity_reconstructable',
      'fail_closed_stewardship_semantics',
      'caretaker_lineage_longitudinally_durable',
      'runtime_stewardship_operationally_stable',
      'stewardship_survivability_scored',
    ]));
  });

  it('fails closed when ignition lacks replay faithfulness, continuity, lineage durability, stability, or survivability scoring', () => {
    const result = evaluateRuntimeStewardshipIgnition({
      ignitionId: IGNITION_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'ignition-broken-1',
          replayTraceId: null,
          replayFaithfulness: 0.2,
          governanceContinuity: 0.2,
          institutionalStability: 0.2,
          stewardshipSurvivability: 0.2,
          ignitionReadiness: 0.2,
          caretakerLineageDurability: 0.2,
          operationalStability: 0.2,
          activated: false,
          immutable: false,
          failClosedReady: false,
          workflowRefs: [],
          governanceContinuityRefs: [],
          replayTelemetryRefs: [],
          caretakerLineageRefs: [],
          harmonizationRefs: [],
          survivabilityRefs: [],
          evidenceRefs: [],
          ambiguityRefs: [],
          ambiguity: 'Ignition packet omitted remote caretaker handoff ambiguity.',
        }),
      ],
    });

    expect(result.status).toBe('STEWARDSHIP_IGNITION_BLOCKED');
    expect(result.verdict).toBe('STEWARDSHIP_IGNITION_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Stewardship replay is not faithful.',
      'Operational ambiguity is not preserved.',
      'Governance continuity is not reconstructable.',
      'Fail-closed stewardship semantics are not ready.',
      'Caretaker lineage is not longitudinally durable.',
      'Runtime stewardship is not operationally stable.',
      'Stewardship survivability is not scored.',
    ]));

    const gate = evaluateRuntimeStewardshipIgnitionGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'stewardship_replay_faithful',
      'ambiguity_preserved_operationally',
      'governance_continuity_reconstructable',
      'fail_closed_stewardship_semantics',
      'caretaker_lineage_longitudinally_durable',
      'runtime_stewardship_operationally_stable',
      'stewardship_survivability_scored',
    ]));
  });

  it('surfaces every stewardship ignition chaos scenario without silent normalization', () => {
    const chaos = runRuntimeStewardshipIgnitionChaosSimulations({
      ignitionId: IGNITION_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(8);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'IGNITION_WORKFLOW_GAP',
      'GOVERNANCE_CONTINUITY_DROP',
      'REPLAY_TELEMETRY_DROP',
      'CARETAKER_HARMONIZATION_GAP',
      'SURVIVABILITY_SCORE_DROP',
      'AMBIGUITY_SUPPRESSION',
      'FAIL_CLOSED_DISABLED',
      'LINEAGE_DURABILITY_COLLAPSE',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
