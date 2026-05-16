import {
  buildRuntimeStewardshipOperationsLineage,
  evaluateRuntimeStewardshipOperations,
  evaluateRuntimeStewardshipOperationsGate,
  runRuntimeStewardshipOperationsChaosSimulations,
  type RuntimeStewardshipOperationsEvidence,
} from '../runtimeStewardshipOperations';

const OPERATIONS_ID = 'runtime-stewardship-ops-165a';
const GENERATED_AT = '2026-05-11T01:30:00.000Z';

function evidence(
  overrides: Partial<RuntimeStewardshipOperationsEvidence> = {},
): RuntimeStewardshipOperationsEvidence {
  return {
    evidenceId: 'stewardship-runbook-1',
    recordedAt: '2026-05-11T01:00:00.000Z',
    domain: 'operational_runbook',
    sourceSystemId: 'runtime-stewardship',
    replayTraceId: 'stewardship-replay-1',
    replayFaithfulness: 0.91,
    runtimeContinuity: 0.9,
    successionSurvivability: 0.9,
    operationalStability: 0.9,
    runtimeSurvivability: 0.9,
    longitudinalDurability: 0.9,
    runbookRefs: ['runbook-primary-1'],
    caretakerWorkflowRefs: ['caretaker-workflow-1'],
    successionPlanRefs: ['succession-plan-1'],
    telemetryRefs: ['stewardship-telemetry-1'],
    evidenceRefs: ['stewardship-evidence-1'],
    continuityLineageRefs: ['continuity-lineage-1'],
    ambiguityRefs: ['ambiguity-retention-1'],
    ambiguity: null,
    failClosedReady: true,
    ...overrides,
  };
}

function baselineEvidence(): RuntimeStewardshipOperationsEvidence[] {
  return [
    evidence(),
    evidence({
      evidenceId: 'stewardship-replay-monitor-1',
      recordedAt: '2026-05-11T01:08:00.000Z',
      domain: 'replay_stewardship_monitoring',
      sourceSystemId: 'replay-stewardship-monitor',
      replayTraceId: 'stewardship-replay-2',
      replayFaithfulness: 0.92,
      runtimeContinuity: 0.9,
      successionSurvivability: 0.9,
      operationalStability: 0.9,
      runtimeSurvivability: 0.9,
      longitudinalDurability: 0.9,
      runbookRefs: ['runbook-replay-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-2'],
      successionPlanRefs: ['succession-plan-2'],
      telemetryRefs: ['replay-monitor-telemetry-1'],
      evidenceRefs: ['replay-stewardship-evidence-1'],
      continuityLineageRefs: ['replay-continuity-lineage-1'],
    }),
    evidence({
      evidenceId: 'stewardship-caretaker-workflow-1',
      recordedAt: '2026-05-11T01:16:00.000Z',
      domain: 'runtime_caretaker_workflow',
      sourceSystemId: 'caretaker-workflow-engine',
      replayTraceId: 'stewardship-replay-3',
      replayFaithfulness: 0.9,
      runtimeContinuity: 0.91,
      successionSurvivability: 0.9,
      operationalStability: 0.91,
      runtimeSurvivability: 0.9,
      longitudinalDurability: 0.9,
      runbookRefs: ['runbook-caretaker-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-3', 'caretaker-escalation-1'],
      successionPlanRefs: ['succession-plan-3'],
      telemetryRefs: ['caretaker-telemetry-1'],
      evidenceRefs: ['caretaker-evidence-1'],
      continuityLineageRefs: ['caretaker-lineage-1'],
    }),
    evidence({
      evidenceId: 'stewardship-telemetry-1',
      recordedAt: '2026-05-11T01:24:00.000Z',
      domain: 'stewardship_telemetry',
      sourceSystemId: 'stewardship-telemetry',
      replayTraceId: 'stewardship-replay-4',
      replayFaithfulness: 0.9,
      runtimeContinuity: 0.9,
      successionSurvivability: 0.9,
      operationalStability: 0.92,
      runtimeSurvivability: 0.9,
      longitudinalDurability: 0.9,
      runbookRefs: ['runbook-telemetry-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-4'],
      successionPlanRefs: ['succession-plan-4'],
      telemetryRefs: ['stewardship-heartbeat-1', 'stewardship-alert-1'],
      evidenceRefs: ['telemetry-evidence-1'],
      continuityLineageRefs: ['telemetry-lineage-1'],
      ambiguityRefs: ['ambiguity-retention-4'],
      ambiguity: 'Caretaker heartbeat includes delayed secondary steward confirmation.',
    }),
    evidence({
      evidenceId: 'stewardship-succession-plan-1',
      recordedAt: '2026-05-11T01:32:00.000Z',
      domain: 'succession_continuity_planning',
      sourceSystemId: 'succession-planner',
      replayTraceId: 'stewardship-replay-5',
      replayFaithfulness: 0.9,
      runtimeContinuity: 0.9,
      successionSurvivability: 0.93,
      operationalStability: 0.9,
      runtimeSurvivability: 0.91,
      longitudinalDurability: 0.91,
      runbookRefs: ['runbook-succession-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-5'],
      successionPlanRefs: ['succession-plan-5', 'emergency-succession-1'],
      telemetryRefs: ['succession-telemetry-1'],
      evidenceRefs: ['succession-evidence-1'],
      continuityLineageRefs: ['succession-lineage-1'],
    }),
    evidence({
      evidenceId: 'stewardship-survivability-1',
      recordedAt: '2026-05-11T01:40:00.000Z',
      domain: 'runtime_survivability',
      sourceSystemId: 'stewardship-survivability',
      replayTraceId: 'stewardship-replay-6',
      replayFaithfulness: 0.9,
      runtimeContinuity: 0.91,
      successionSurvivability: 0.9,
      operationalStability: 0.91,
      runtimeSurvivability: 0.93,
      longitudinalDurability: 0.91,
      runbookRefs: ['runbook-survivability-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-6'],
      successionPlanRefs: ['succession-plan-6'],
      telemetryRefs: ['survivability-telemetry-1'],
      evidenceRefs: ['survivability-evidence-1'],
      continuityLineageRefs: ['survivability-lineage-1'],
    }),
    evidence({
      evidenceId: 'stewardship-longitudinal-1',
      recordedAt: '2026-05-11T01:48:00.000Z',
      domain: 'longitudinal_continuity',
      sourceSystemId: 'stewardship-longitudinal',
      replayTraceId: 'stewardship-replay-7',
      replayFaithfulness: 0.9,
      runtimeContinuity: 0.91,
      successionSurvivability: 0.91,
      operationalStability: 0.9,
      runtimeSurvivability: 0.91,
      longitudinalDurability: 0.93,
      runbookRefs: ['runbook-longitudinal-1'],
      caretakerWorkflowRefs: ['caretaker-workflow-7'],
      successionPlanRefs: ['succession-plan-7'],
      telemetryRefs: ['longitudinal-telemetry-1'],
      evidenceRefs: ['longitudinal-evidence-1'],
      continuityLineageRefs: ['longitudinal-lineage-1'],
    }),
  ];
}

describe('W2-PR165A runtime stewardship operations', () => {
  it('builds deterministic stewardship operations lineage from unordered evidence', () => {
    const baseline = baselineEvidence();
    const lineage = buildRuntimeStewardshipOperationsLineage({
      operationsId: OPERATIONS_ID,
      generatedAt: GENERATED_AT,
      evidence: [...baseline].reverse(),
    });
    const repeat = buildRuntimeStewardshipOperationsLineage({
      operationsId: OPERATIONS_ID,
      generatedAt: GENERATED_AT,
      evidence: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { evidenceId: string }) => entry.evidenceId)).toEqual([
      'stewardship-runbook-1',
      'stewardship-replay-monitor-1',
      'stewardship-caretaker-workflow-1',
      'stewardship-telemetry-1',
      'stewardship-succession-plan-1',
      'stewardship-survivability-1',
      'stewardship-longitudinal-1',
    ]);
    expect(lineage.domainsObserved).toEqual([
      'operational_runbook',
      'replay_stewardship_monitoring',
      'runtime_caretaker_workflow',
      'stewardship_telemetry',
      'succession_continuity_planning',
      'runtime_survivability',
      'longitudinal_continuity',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-11T01:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-11T01:48:00.000Z');
  });

  it('scores runbooks, replay monitoring, caretaker workflows, telemetry, succession, and continuity durability', () => {
    const result = evaluateRuntimeStewardshipOperations({
      operationsId: OPERATIONS_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(result.status).toBe('STEWARDSHIP_OPERATIONS_DEGRADED');
    expect(result.verdict).toBe('STEWARDSHIP_OPERATIONS_FINALIZED_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayStewardship.faithful).toBe(true);
    expect(result.replayStewardship.fidelityPct).toBeGreaterThanOrEqual(90);
    expect(result.runtimeContinuity.measurable).toBe(true);
    expect(result.caretakerOperations.workflowsReady).toBe(true);
    expect(result.successionContinuity.survivable).toBe(true);
    expect(result.operationalStability.stable).toBe(true);
    expect(result.continuityLineage.reconstructable).toBe(true);
    expect(result.ambiguities).toEqual([
      'Caretaker heartbeat includes delayed secondary steward confirmation.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'stewardship_replay_faithful',
      'ambiguity_preserved_operationally',
      'continuity_lineage_reconstructable',
      'fail_closed_stewardship_semantics',
      'runtime_survivability_measurable',
      'operational_continuity_longitudinally_durable',
      'succession_continuity_survivable',
    ]));
  });

  it('fails closed when operations lack replay faithfulness, lineage, succession, survivability, or durable continuity', () => {
    const result = evaluateRuntimeStewardshipOperations({
      operationsId: OPERATIONS_ID,
      generatedAt: GENERATED_AT,
      evidence: [
        evidence({
          evidenceId: 'stewardship-broken-1',
          replayTraceId: null,
          replayFaithfulness: 0.2,
          runtimeContinuity: 0.2,
          successionSurvivability: 0.2,
          operationalStability: 0.2,
          runtimeSurvivability: 0.2,
          longitudinalDurability: 0.2,
          runbookRefs: [],
          caretakerWorkflowRefs: [],
          successionPlanRefs: [],
          telemetryRefs: [],
          evidenceRefs: [],
          continuityLineageRefs: [],
          ambiguityRefs: [],
          ambiguity: 'Operational handoff evidence omitted secondary steward confirmation.',
          failClosedReady: false,
        }),
      ],
    });

    expect(result.status).toBe('STEWARDSHIP_OPERATIONS_BLOCKED');
    expect(result.verdict).toBe('STEWARDSHIP_OPERATIONS_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Replay stewardship is not faithful.',
      'Operational ambiguity is not preserved.',
      'Continuity lineage is not reconstructable.',
      'Fail-closed stewardship semantics are not ready.',
      'Runtime survivability is not measurable.',
      'Operational continuity is not longitudinally durable.',
      'Succession continuity is not survivable.',
    ]));

    const gate = evaluateRuntimeStewardshipOperationsGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'stewardship_replay_faithful',
      'ambiguity_preserved_operationally',
      'continuity_lineage_reconstructable',
      'fail_closed_stewardship_semantics',
      'runtime_survivability_measurable',
      'operational_continuity_longitudinally_durable',
      'succession_continuity_survivable',
    ]));
  });

  it('surfaces every stewardship operations chaos scenario without silent normalization', () => {
    const chaos = runRuntimeStewardshipOperationsChaosSimulations({
      operationsId: OPERATIONS_ID,
      generatedAt: GENERATED_AT,
      evidence: baselineEvidence(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(8);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'RUNBOOK_GAP',
      'REPLAY_MONITORING_GAP',
      'CARETAKER_WORKFLOW_GAP',
      'TELEMETRY_DROP',
      'SUCCESSION_PLAN_COLLAPSE',
      'AMBIGUITY_SUPPRESSION',
      'FAIL_CLOSED_DISABLED',
      'LONGITUDINAL_DURABILITY_COLLAPSE',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
