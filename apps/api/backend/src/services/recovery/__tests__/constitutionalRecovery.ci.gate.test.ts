import {
  evaluateRecoveryGate,
  evaluateRecoveryStep,
  type RecoveryEvent,
} from '../constitutionalRecovery';

function event(type: RecoveryEvent['type'], evidenceRefs: string[]): RecoveryEvent {
  return {
    id: `event-${type}`,
    type,
    actor: 'system',
    recordedAt: '2026-05-09T20:00:00.000Z',
    evidenceRefs,
    ambiguity: null,
  };
}

describe('CI gate — constitutional recovery protocol', () => {
  it('requires replay-safe restoration, visible ambiguity semantics, reconstructable continuity, and evidence-derived confidence', () => {
    const result = evaluateRecoveryStep({
      currentState: 'RESTORING',
      event: event('restoration_verified', [
        'capsule-replay-report',
        'governance-attestation',
        'operator-runbook',
      ]),
      replayContinuity: 'RESTORED',
      continuityEvidenceRefs: ['timeline-before', 'timeline-during', 'timeline-after'],
    });

    const gate = evaluateRecoveryGate({ result });

    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((g) => g.id)).toEqual([
      'state_machine_integrity',
      'replay_restoration_fidelity',
      'ambiguity_visible',
      'continuity_reconstructable',
      'fail_closed_restoration',
      'confidence_evidence_derived',
      'longitudinal_timeline_visible',
    ]);
  });
});
