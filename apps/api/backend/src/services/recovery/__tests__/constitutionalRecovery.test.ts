import {
  buildConstitutionalRecoveryLineage,
  computeRecoveryConfidence,
  evaluateRecoveryGate,
  evaluateRecoveryStep,
  runRecoveryChaosSimulations,
  type RecoveryEvent,
} from '../constitutionalRecovery';

const RECORDED_AT = '2026-05-09T20:00:00.000Z';

function event(overrides: Partial<RecoveryEvent> = {}): RecoveryEvent {
  return {
    id: 'event-1',
    recordedAt: RECORDED_AT,
    actor: 'system',
    type: 'replay_degradation_detected',
    evidenceRefs: ['replay-capsule-1'],
    ambiguity: 'outer replay category hides original mutation class',
    ...overrides,
  };
}

describe('constitutional recovery state machine', () => {
  it('moves from detected to contained only with recovery evidence and preserves ambiguity', () => {
    const result = evaluateRecoveryStep({
      currentState: 'DEGRADED_DETECTED',
      event: event({
        type: 'containment_started',
        evidenceRefs: ['containment-runbook', 'audit-window-1'],
      }),
      replayContinuity: 'DEGRADED',
      continuityEvidenceRefs: ['timeline-1'],
    });

    expect(result.nextState).toBe('CONTAINED');
    expect(result.restorationAllowed).toBe(false);
    expect(result.failClosed).toBe(true);
    expect(result.ambiguities).toContain('outer replay category hides original mutation class');
    expect(result.replayRestoration.status).toBe('DEGRADED');
  });

  it('fails closed when restoration is requested before replay continuity is restored', () => {
    const result = evaluateRecoveryStep({
      currentState: 'RESTORING',
      event: event({
        type: 'restoration_requested',
        evidenceRefs: ['operator-attestation'],
      }),
      replayContinuity: 'BROKEN',
      continuityEvidenceRefs: ['missing-capsule-window'],
    });

    expect(result.nextState).toBe('RESTORATION_BLOCKED');
    expect(result.restorationAllowed).toBe(false);
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toContain('Replay continuity is BROKEN; restoration cannot be declared.');
  });

  it('allows restored state only with replay continuity, continuity lineage, and evidence-derived confidence', () => {
    const result = evaluateRecoveryStep({
      currentState: 'RESTORING',
      event: event({
        type: 'restoration_verified',
        evidenceRefs: ['capsule-replay-report', 'governance-attestation', 'operator-runbook'],
        ambiguity: null,
      }),
      replayContinuity: 'RESTORED',
      continuityEvidenceRefs: ['timeline-before', 'timeline-during', 'timeline-after'],
    });

    expect(result.nextState).toBe('RESTORED_UNDER_OBSERVATION');
    expect(result.restorationAllowed).toBe(true);
    expect(result.failClosed).toBe(false);
    expect(result.confidence.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'replay_continuity_restored',
      'continuity_lineage_reconstructable',
      'restoration_evidence_present',
    ]));
  });
});

describe('constitutional recovery confidence and lineage', () => {
  it('derives confidence from evidence instead of operator assertion', () => {
    const confidence = computeRecoveryConfidence({
      state: 'RESTORED_UNDER_OBSERVATION',
      replayContinuity: 'RESTORED',
      evidenceRefs: ['capsule-replay-report', 'governance-attestation'],
      continuityEvidenceRefs: ['before', 'during', 'after'],
      ambiguityCount: 0,
    });

    expect(confidence.score).toBe(86);
    expect(confidence.label).toBe('HIGH_EVIDENCE');
    expect(confidence.basis).toContain('restoration_evidence_present');
    expect(confidence.basis).not.toContain('operator_asserted');
  });

  it('builds deterministic lineage that keeps recovery timelines longitudinally visible', () => {
    const lineage = buildConstitutionalRecoveryLineage({
      incidentId: 'incident-1',
      events: [
        event({ id: 'event-2', recordedAt: '2026-05-09T21:00:00.000Z', type: 'continuity_rebuilt' }),
        event({ id: 'event-1', recordedAt: '2026-05-09T20:00:00.000Z', type: 'replay_degradation_detected' }),
      ],
    });
    const repeat = buildConstitutionalRecoveryLineage({
      incidentId: 'incident-1',
      events: [
        event({ id: 'event-2', recordedAt: '2026-05-09T21:00:00.000Z', type: 'continuity_rebuilt' }),
        event({ id: 'event-1', recordedAt: '2026-05-09T20:00:00.000Z', type: 'replay_degradation_detected' }),
      ],
    });

    expect(lineage.timeline.map((entry) => entry.eventId)).toEqual(['event-1', 'event-2']);
    expect(lineage.timeline[0]?.position).toBe(0);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.lineageHash).toBe(repeat.lineageHash);
  });
});

describe('constitutional recovery chaos simulations', () => {
  it('surfaces replay degradation, governance corruption, trust fragmentation, and continuity collapse', () => {
    const result = runRecoveryChaosSimulations({
      incidentId: 'incident-chaos',
      baselineEvidenceRefs: ['capsule-replay-report', 'governance-attestation', 'operator-runbook'],
      baselineContinuityEvidenceRefs: ['before', 'during', 'after'],
    });

    expect(result.summary.totalScenarios).toBeGreaterThanOrEqual(4);
    expect(result.summary.silentCount).toBe(0);
    expect(result.verdicts.find((v) => v.scenario === 'REPLAY_DEGRADATION')?.signalSurfaced).toBe(true);
    expect(result.verdicts.find((v) => v.scenario === 'GOVERNANCE_CORRUPTION')?.signalSurfaced).toBe(true);
    expect(result.verdicts.find((v) => v.scenario === 'TRUST_FRAGMENTATION')?.signalSurfaced).toBe(true);
    expect(result.verdicts.find((v) => v.scenario === 'CONTINUITY_COLLAPSE')?.signalSurfaced).toBe(true);
  });

  it('CI gate rejects restoration when ambiguity or replay continuity is hidden', () => {
    const gate = evaluateRecoveryGate({
      result: evaluateRecoveryStep({
        currentState: 'RESTORING',
        event: event({
          type: 'restoration_verified',
          evidenceRefs: ['operator-attestation'],
          ambiguity: null,
        }),
        replayContinuity: 'BROKEN',
        continuityEvidenceRefs: [],
      }),
    });

    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'replay_restoration_fidelity',
      'continuity_reconstructable',
      'fail_closed_restoration',
    ]));
  });
});
