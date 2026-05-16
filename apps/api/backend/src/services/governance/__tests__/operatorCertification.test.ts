import {
  buildOperatorCompetencyLineage,
  evaluateOperatorCertification,
  evaluateOperatorCertificationGate,
  runOperatorCertificationChaosSimulations,
  type OperatorTrainingEvent,
} from '../operatorCertification';

const OPERATOR_ID = 'operator-1';
const INSTITUTION_ID = 'institution-1';
const EVALUATED_AT = '2026-05-10T18:00:00.000Z';
const POLICY_VERSION = 'governance-policy-v1';
const REPLAY_DIGEST = 'replay-governance-digest-1';

function event(overrides: Partial<OperatorTrainingEvent> = {}): OperatorTrainingEvent {
  return {
    id: 'event-1',
    operatorId: OPERATOR_ID,
    institutionId: INSTITUTION_ID,
    occurredAt: '2026-05-10T16:00:00.000Z',
    kind: 'training_completed',
    competencyArea: 'governance_policy',
    policyVersion: POLICY_VERSION,
    score: 92,
    maxScore: 100,
    outcome: 'PASS',
    evidenceRefs: ['training-module-1', 'operator-attestation-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineEvents(): OperatorTrainingEvent[] {
  return [
    event({
      id: 'event-review',
      occurredAt: '2026-05-10T16:30:00.000Z',
      kind: 'review_simulation',
      competencyArea: 'institutional_review',
      score: 91,
      evidenceRefs: ['review-simulation-1', 'review-rubric-1'],
    }),
    event({
      id: 'event-replay',
      occurredAt: '2026-05-10T16:10:00.000Z',
      kind: 'replay_assessment',
      competencyArea: 'replay_governance',
      score: 94,
      evidenceRefs: ['replay-assessment-1', 'replay-transcript-1'],
    }),
    event({
      id: 'event-training',
      occurredAt: '2026-05-10T16:00:00.000Z',
      kind: 'training_completed',
      competencyArea: 'governance_policy',
      score: 93,
      evidenceRefs: ['training-module-1', 'operator-attestation-1'],
    }),
    event({
      id: 'event-ambiguity',
      occurredAt: '2026-05-10T16:40:00.000Z',
      kind: 'ambiguity_review',
      competencyArea: 'ambiguity_handling',
      score: 90,
      evidenceRefs: ['ambiguity-case-1', 'ambiguity-rubric-1'],
      ambiguity: 'authority label remains unresolved until state-board adapter returns',
    }),
    event({
      id: 'event-replay-drill',
      occurredAt: '2026-05-10T16:20:00.000Z',
      kind: 'replay_drill',
      competencyArea: 'replay_governance',
      score: 89,
      evidenceRefs: ['replay-drill-1', 'decision-capsule-1'],
    }),
  ];
}

describe('operator competency lineage', () => {
  it('builds deterministic longitudinal training lineage across unordered events', () => {
    const lineage = buildOperatorCompetencyLineage({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      events: baselineEvents(),
    });
    const repeat = buildOperatorCompetencyLineage({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      events: [...baselineEvents()].reverse(),
    });

    expect(lineage.timeline.map((entry) => entry.eventId)).toEqual([
      'event-training',
      'event-replay',
      'event-replay-drill',
      'event-review',
      'event-ambiguity',
    ]);
    expect(lineage.firstOccurredAt).toBe('2026-05-10T16:00:00.000Z');
    expect(lineage.lastOccurredAt).toBe('2026-05-10T16:40:00.000Z');
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.lineageHash).toBe(repeat.lineageHash);
  });
});

describe('operator certification evaluation', () => {
  it('certifies only when replay governance, review proficiency, lineage, and survivability are evidenced', () => {
    const certification = evaluateOperatorCertification({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      evaluatedAt: EVALUATED_AT,
      policyVersion: POLICY_VERSION,
      events: baselineEvents(),
      expectedReplayGovernanceDigest: REPLAY_DIGEST,
      currentReplayGovernanceDigest: REPLAY_DIGEST,
    });

    expect(certification.status).toBe('CERTIFIED');
    expect(certification.certificationAllowed).toBe(true);
    expect(certification.failClosed).toBe(false);
    expect(certification.replayGovernance.score).toBeGreaterThanOrEqual(85);
    expect(certification.replayGovernance.understandingMeasured).toBe(true);
    expect(certification.reviewProficiency.score).toBeGreaterThanOrEqual(85);
    expect(certification.trainingLineage.timeline).toHaveLength(5);
    expect(certification.survivability.replaySurvivable).toBe(true);
    expect(certification.operatorDrift.detected).toBe(false);
    expect(certification.certificationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(certification.confidence.basis).toEqual(expect.arrayContaining([
      'replay_governance_assessment_passed',
      'institutional_review_simulation_passed',
      'training_lineage_reconstructable',
    ]));
  });

  it('fails closed and preserves ambiguity when replay-governance competency is not proven', () => {
    const certification = evaluateOperatorCertification({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      evaluatedAt: EVALUATED_AT,
      policyVersion: POLICY_VERSION,
      events: [
        event({
          id: 'weak-replay',
          kind: 'replay_assessment',
          competencyArea: 'replay_governance',
          score: 67,
          evidenceRefs: ['single-replay-note'],
          ambiguity: 'policy exception phrasing unresolved',
        }),
        event({
          id: 'weak-review',
          kind: 'review_simulation',
          competencyArea: 'institutional_review',
          score: 81,
          evidenceRefs: ['review-note'],
        }),
      ],
      expectedReplayGovernanceDigest: REPLAY_DIGEST,
      currentReplayGovernanceDigest: REPLAY_DIGEST,
    });

    expect(certification.status).toBe('CERTIFICATION_BLOCKED');
    expect(certification.certificationAllowed).toBe(false);
    expect(certification.failClosed).toBe(true);
    expect(certification.blockers).toContain('Replay governance competency below certification threshold.');
    expect(certification.ambiguities).toContain('policy exception phrasing unresolved');
  });

  it('detects operator drift and contains certification replay instead of certifying stale governance understanding', () => {
    const certification = evaluateOperatorCertification({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      evaluatedAt: EVALUATED_AT,
      policyVersion: POLICY_VERSION,
      events: baselineEvents(),
      expectedReplayGovernanceDigest: REPLAY_DIGEST,
      currentReplayGovernanceDigest: 'replay-governance-digest-drifted',
    });

    expect(certification.status).toBe('CERTIFICATION_BLOCKED');
    expect(certification.operatorDrift.detected).toBe(true);
    expect(certification.operatorDrift.containment).toBe('DRIFT_CONTAINED');
    expect(certification.blockers).toContain('Operator governance digest drift detected.');
  });
});

describe('operator certification chaos simulations', () => {
  it('surfaces replay misunderstanding, lineage gaps, review drops, ambiguity, and drift', () => {
    const chaos = runOperatorCertificationChaosSimulations({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      evaluatedAt: EVALUATED_AT,
      policyVersion: POLICY_VERSION,
      baselineEvents: baselineEvents(),
      expectedReplayGovernanceDigest: REPLAY_DIGEST,
    });

    expect(chaos.summary.totalScenarios).toBeGreaterThanOrEqual(5);
    expect(chaos.summary.silentCount).toBe(0);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'REPLAY_MISUNDERSTANDING')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'LINEAGE_GAP')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'REVIEW_PROFICIENCY_DROP')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'TRAINING_AMBIGUITY')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'OPERATOR_DRIFT')?.signalSurfaced).toBe(true);
  });

  it('CI gate rejects certification when ambiguity and replay survivability are not safely handled', () => {
    const certification = evaluateOperatorCertification({
      operatorId: OPERATOR_ID,
      institutionId: INSTITUTION_ID,
      evaluatedAt: EVALUATED_AT,
      policyVersion: POLICY_VERSION,
      events: [
        event({
          id: 'ambiguous-replay',
          kind: 'replay_assessment',
          competencyArea: 'replay_governance',
          score: 76,
          evidenceRefs: [],
          ambiguity: 'operator cannot distinguish replay warning from policy denial',
        }),
      ],
      expectedReplayGovernanceDigest: REPLAY_DIGEST,
      currentReplayGovernanceDigest: REPLAY_DIGEST,
    });

    const gate = evaluateOperatorCertificationGate({ certification });

    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'replay_governance_measurable',
      'fail_closed_certification',
      'certification_replay_survivable',
    ]));
  });
});
