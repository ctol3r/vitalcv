import {
  evaluateOperatorCertification,
  evaluateOperatorCertificationGate,
  type OperatorTrainingEvent,
} from '../operatorCertification';

const operatorId = 'operator-ci';
const institutionId = 'institution-ci';
const policyVersion = 'governance-policy-v1';
const replayDigest = 'replay-governance-digest-ci';

function event(overrides: Partial<OperatorTrainingEvent>): OperatorTrainingEvent {
  return {
    id: overrides.id ?? 'event-ci',
    operatorId,
    institutionId,
    occurredAt: overrides.occurredAt ?? '2026-05-10T16:00:00.000Z',
    kind: overrides.kind ?? 'training_completed',
    competencyArea: overrides.competencyArea ?? 'governance_policy',
    policyVersion,
    score: overrides.score ?? 92,
    maxScore: 100,
    outcome: overrides.outcome ?? 'PASS',
    evidenceRefs: overrides.evidenceRefs ?? ['training-evidence', 'operator-attestation'],
    ambiguity: overrides.ambiguity ?? null,
  };
}

describe('CI gate — institutional operator certification', () => {
  it('requires reconstructable competency, measurable replay governance, visible drift, fail-closed semantics, and replay survivability', () => {
    const certification = evaluateOperatorCertification({
      operatorId,
      institutionId,
      evaluatedAt: '2026-05-10T18:00:00.000Z',
      policyVersion,
      expectedReplayGovernanceDigest: replayDigest,
      currentReplayGovernanceDigest: replayDigest,
      events: [
        event({
          id: 'ci-training',
          kind: 'training_completed',
          competencyArea: 'governance_policy',
          occurredAt: '2026-05-10T16:00:00.000Z',
          score: 92,
        }),
        event({
          id: 'ci-replay',
          kind: 'replay_assessment',
          competencyArea: 'replay_governance',
          occurredAt: '2026-05-10T16:10:00.000Z',
          score: 95,
          evidenceRefs: ['replay-assessment', 'replay-transcript'],
        }),
        event({
          id: 'ci-review',
          kind: 'review_simulation',
          competencyArea: 'institutional_review',
          occurredAt: '2026-05-10T16:20:00.000Z',
          score: 91,
          evidenceRefs: ['review-simulation', 'review-rubric'],
        }),
        event({
          id: 'ci-ambiguity',
          kind: 'ambiguity_review',
          competencyArea: 'ambiguity_handling',
          occurredAt: '2026-05-10T16:30:00.000Z',
          score: 90,
          evidenceRefs: ['ambiguity-case', 'ambiguity-rubric'],
          ambiguity: 'manual policy exception remains flagged for reviewer escalation',
        }),
      ],
    });

    const gate = evaluateOperatorCertificationGate({ certification });

    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateVerdict) => gateVerdict.id)).toEqual([
      'competency_lineage_reconstructable',
      'replay_governance_measurable',
      'ambiguity_preserved',
      'fail_closed_certification',
      'training_timeline_visible',
      'operator_drift_detectable',
      'certification_replay_survivable',
    ]);
  });
});
