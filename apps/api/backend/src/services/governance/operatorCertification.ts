import { sha256ForPayload } from '../../utils/deterministic';

export type OperatorTrainingEventKind =
  | 'training_completed'
  | 'replay_assessment'
  | 'replay_drill'
  | 'review_simulation'
  | 'ambiguity_review'
  | 'drift_observed';

export type OperatorCompetencyArea =
  | 'governance_policy'
  | 'replay_governance'
  | 'institutional_review'
  | 'ambiguity_handling'
  | 'operator_drift';

export type OperatorTrainingOutcome = 'PASS' | 'PARTIAL' | 'FAIL';

export interface OperatorTrainingEvent {
  id: string;
  operatorId: string;
  institutionId: string;
  occurredAt: string;
  kind: OperatorTrainingEventKind;
  competencyArea: OperatorCompetencyArea;
  policyVersion: string;
  score: number;
  maxScore: number;
  outcome: OperatorTrainingOutcome;
  evidenceRefs: string[];
  ambiguity: string | null;
}

export interface OperatorCompetencyLineageEntry {
  position: number;
  eventId: string;
  operatorId: string;
  institutionId: string;
  occurredAt: string;
  kind: OperatorTrainingEventKind;
  competencyArea: OperatorCompetencyArea;
  policyVersion: string;
  score: number;
  maxScore: number;
  outcome: OperatorTrainingOutcome;
  evidenceRefs: string[];
  ambiguity: string | null;
  eventHash: string;
}

export interface OperatorCompetencyLineage {
  schema: 'vitalcv.operator-competency-lineage.v1';
  operatorId: string;
  institutionId: string;
  timeline: OperatorCompetencyLineageEntry[];
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  lineageHash: string;
}

export interface BuildOperatorCompetencyLineageInput {
  operatorId: string;
  institutionId: string;
  events: OperatorTrainingEvent[];
}

export interface OperatorReplayGovernanceCompetency {
  score: number;
  understandingMeasured: boolean;
  assessmentCount: number;
  evidenceRefs: string[];
}

export interface OperatorReviewProficiency {
  score: number;
  scenarioCount: number;
  passedScenarioCount: number;
  evidenceRefs: string[];
}

export interface OperatorCertificationSurvivability {
  replaySurvivable: boolean;
  lineageHashVerified: boolean;
  replayEvidenceRefs: string[];
  survivabilityHash: string;
}

export interface OperatorDriftSignal {
  detected: boolean;
  expectedReplayGovernanceDigest: string;
  currentReplayGovernanceDigest: string;
  containment: 'NO_DRIFT' | 'DRIFT_CONTAINED';
  driftHash: string;
}

export interface OperatorCertificationConfidence {
  score: number;
  label: 'HIGH_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'BLOCKED';
  basis: string[];
  confidenceHash: string;
}

export type OperatorCertificationStatus =
  | 'CERTIFIED'
  | 'CERTIFICATION_BLOCKED';

export interface OperatorCertificationResult {
  schema: 'vitalcv.operator-certification.v1';
  operatorId: string;
  institutionId: string;
  evaluatedAt: string;
  policyVersion: string;
  status: OperatorCertificationStatus;
  certificationAllowed: boolean;
  failClosed: boolean;
  blockers: string[];
  ambiguities: string[];
  ambiguityPreserved: boolean;
  trainingLineage: OperatorCompetencyLineage;
  replayGovernance: OperatorReplayGovernanceCompetency;
  reviewProficiency: OperatorReviewProficiency;
  survivability: OperatorCertificationSurvivability;
  operatorDrift: OperatorDriftSignal;
  confidence: OperatorCertificationConfidence;
  certificationHash: string;
}

export interface EvaluateOperatorCertificationInput {
  operatorId: string;
  institutionId: string;
  evaluatedAt: string;
  policyVersion: string;
  events: OperatorTrainingEvent[];
  expectedReplayGovernanceDigest: string;
  currentReplayGovernanceDigest: string;
}

export type OperatorCertificationGateId =
  | 'competency_lineage_reconstructable'
  | 'replay_governance_measurable'
  | 'ambiguity_preserved'
  | 'fail_closed_certification'
  | 'training_timeline_visible'
  | 'operator_drift_detectable'
  | 'certification_replay_survivable';

export interface OperatorCertificationGateVerdict {
  id: OperatorCertificationGateId;
  pass: boolean;
  reason: string;
}

export interface OperatorCertificationGateResult {
  pass: boolean;
  gates: OperatorCertificationGateVerdict[];
  failedGateIds: OperatorCertificationGateId[];
}

export type OperatorCertificationChaosScenario =
  | 'BASELINE'
  | 'REPLAY_MISUNDERSTANDING'
  | 'LINEAGE_GAP'
  | 'REVIEW_PROFICIENCY_DROP'
  | 'TRAINING_AMBIGUITY'
  | 'OPERATOR_DRIFT';

export interface OperatorCertificationChaosVerdict {
  scenario: OperatorCertificationChaosScenario;
  signalSurfaced: boolean;
  status: OperatorCertificationStatus;
  failedGateIds: OperatorCertificationGateId[];
}

export interface OperatorCertificationChaosResult {
  verdicts: OperatorCertificationChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

export interface RunOperatorCertificationChaosInput {
  operatorId: string;
  institutionId: string;
  evaluatedAt: string;
  policyVersion: string;
  baselineEvents: OperatorTrainingEvent[];
  expectedReplayGovernanceDigest: string;
}

const CERTIFICATION_THRESHOLD = 85;
const MIN_LINEAGE_EVENTS = 3;
const MIN_EVIDENCE_REFS = 2;

function cleanRefs(refs: readonly string[]): string[] {
  return Array.from(
    new Set(
      refs
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function cleanAmbiguities(events: readonly OperatorTrainingEvent[]): string[] {
  return Array.from(
    new Set(
      events
        .map((event) => event.ambiguity?.trim() ?? '')
        .filter((ambiguity) => ambiguity.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function normalizedScore(event: OperatorTrainingEvent): number {
  if (event.maxScore <= 0) return 0;
  return Math.round((event.score / event.maxScore) * 100);
}

function averageScore(events: readonly OperatorTrainingEvent[]): number {
  if (events.length === 0) return 0;
  const total = events.reduce((sum, event) => sum + normalizedScore(event), 0);
  return Math.round(total / events.length);
}

function evidenceFor(events: readonly OperatorTrainingEvent[]): string[] {
  return cleanRefs(events.flatMap((event) => event.evidenceRefs));
}

function isReplayEvent(event: OperatorTrainingEvent): boolean {
  return (
    event.competencyArea === 'replay_governance'
    || event.kind === 'replay_assessment'
    || event.kind === 'replay_drill'
  );
}

function isReviewEvent(event: OperatorTrainingEvent): boolean {
  return (
    event.competencyArea === 'institutional_review'
    || event.kind === 'review_simulation'
  );
}

function isAmbiguityEvent(event: OperatorTrainingEvent): boolean {
  return (
    event.competencyArea === 'ambiguity_handling'
    || event.kind === 'ambiguity_review'
  );
}

export function buildOperatorCompetencyLineage(
  input: BuildOperatorCompetencyLineageInput,
): OperatorCompetencyLineage {
  const timeline = [...input.events]
    .sort((left, right) => (
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
      || left.id.localeCompare(right.id)
    ))
    .map((event, position): OperatorCompetencyLineageEntry => {
      const body = {
        eventId: event.id,
        operatorId: event.operatorId,
        institutionId: event.institutionId,
        occurredAt: event.occurredAt,
        kind: event.kind,
        competencyArea: event.competencyArea,
        policyVersion: event.policyVersion,
        score: event.score,
        maxScore: event.maxScore,
        outcome: event.outcome,
        evidenceRefs: cleanRefs(event.evidenceRefs),
        ambiguity: event.ambiguity?.trim() || null,
      };

      return {
        position,
        ...body,
        eventHash: sha256ForPayload(body),
      };
    });
  const body = {
    schema: 'vitalcv.operator-competency-lineage.v1' as const,
    operatorId: input.operatorId,
    institutionId: input.institutionId,
    timeline,
    firstOccurredAt: timeline[0]?.occurredAt ?? null,
    lastOccurredAt: timeline[timeline.length - 1]?.occurredAt ?? null,
  };

  return {
    ...body,
    lineageHash: sha256ForPayload(body),
  };
}

function evaluateReplayGovernance(events: readonly OperatorTrainingEvent[]): OperatorReplayGovernanceCompetency {
  const replayEvents = events.filter(isReplayEvent);
  const evidenceRefs = evidenceFor(replayEvents);
  const score = averageScore(replayEvents);

  return {
    score,
    understandingMeasured:
      score >= CERTIFICATION_THRESHOLD
      && replayEvents.some((event) => event.kind === 'replay_assessment')
      && evidenceRefs.length >= MIN_EVIDENCE_REFS,
    assessmentCount: replayEvents.length,
    evidenceRefs,
  };
}

function evaluateReviewProficiency(events: readonly OperatorTrainingEvent[]): OperatorReviewProficiency {
  const reviewEvents = events.filter(isReviewEvent);
  const evidenceRefs = evidenceFor(reviewEvents);
  const score = averageScore(reviewEvents);

  return {
    score,
    scenarioCount: reviewEvents.length,
    passedScenarioCount: reviewEvents.filter(
      (event) => normalizedScore(event) >= CERTIFICATION_THRESHOLD && event.outcome === 'PASS',
    ).length,
    evidenceRefs,
  };
}

function ambiguityHandlingPasses(
  events: readonly OperatorTrainingEvent[],
  ambiguities: readonly string[],
): boolean {
  if (ambiguities.length === 0) return true;

  const ambiguityEvents = events.filter(isAmbiguityEvent);
  return (
    averageScore(ambiguityEvents) >= CERTIFICATION_THRESHOLD
    && evidenceFor(ambiguityEvents).length >= MIN_EVIDENCE_REFS
  );
}

function evaluateOperatorDrift(input: EvaluateOperatorCertificationInput): OperatorDriftSignal {
  const digestDrift =
    input.expectedReplayGovernanceDigest !== input.currentReplayGovernanceDigest;
  const observedDrift = input.events.some(
    (event) => event.kind === 'drift_observed' || event.competencyArea === 'operator_drift',
  );
  const detected = digestDrift || observedDrift;
  const body = {
    schema: 'vitalcv.operator-drift-signal.v1' as const,
    operatorId: input.operatorId,
    institutionId: input.institutionId,
    expectedReplayGovernanceDigest: input.expectedReplayGovernanceDigest,
    currentReplayGovernanceDigest: input.currentReplayGovernanceDigest,
    detected,
  };

  return {
    detected,
    expectedReplayGovernanceDigest: input.expectedReplayGovernanceDigest,
    currentReplayGovernanceDigest: input.currentReplayGovernanceDigest,
    containment: detected ? 'DRIFT_CONTAINED' : 'NO_DRIFT',
    driftHash: sha256ForPayload(body),
  };
}

function buildSurvivability(input: {
  lineage: OperatorCompetencyLineage;
  replayGovernance: OperatorReplayGovernanceCompetency;
  operatorDrift: OperatorDriftSignal;
}): OperatorCertificationSurvivability {
  const lineageHashVerified = /^[a-f0-9]{64}$/.test(input.lineage.lineageHash)
    && input.lineage.timeline.length >= MIN_LINEAGE_EVENTS;
  const replaySurvivable =
    lineageHashVerified
    && input.replayGovernance.understandingMeasured
    && input.replayGovernance.evidenceRefs.length >= MIN_EVIDENCE_REFS
    && !input.operatorDrift.detected;
  const body = {
    schema: 'vitalcv.operator-certification-survivability.v1' as const,
    lineageHash: input.lineage.lineageHash,
    replayEvidenceRefs: input.replayGovernance.evidenceRefs,
    replaySurvivable,
    operatorDrift: input.operatorDrift.containment,
  };

  return {
    replaySurvivable,
    lineageHashVerified,
    replayEvidenceRefs: input.replayGovernance.evidenceRefs,
    survivabilityHash: sha256ForPayload(body),
  };
}

function buildBlockers(input: {
  lineage: OperatorCompetencyLineage;
  replayGovernance: OperatorReplayGovernanceCompetency;
  reviewProficiency: OperatorReviewProficiency;
  survivability: OperatorCertificationSurvivability;
  operatorDrift: OperatorDriftSignal;
  ambiguityHandled: boolean;
}): string[] {
  const blockers: string[] = [];

  if (input.lineage.timeline.length < MIN_LINEAGE_EVENTS) {
    blockers.push('Competency lineage is not reconstructable.');
  }

  if (!input.replayGovernance.understandingMeasured) {
    blockers.push('Replay governance competency below certification threshold.');
  }

  if (
    input.reviewProficiency.score < CERTIFICATION_THRESHOLD
    || input.reviewProficiency.evidenceRefs.length < MIN_EVIDENCE_REFS
  ) {
    blockers.push('Institutional review proficiency below certification threshold.');
  }

  if (!input.ambiguityHandled) {
    blockers.push('Ambiguity handling competency below certification threshold.');
  }

  if (input.operatorDrift.detected) {
    blockers.push('Operator governance digest drift detected.');
  }

  if (!input.survivability.replaySurvivable) {
    blockers.push('Certification replay survivability is not proven.');
  }

  return Array.from(new Set(blockers));
}

function buildConfidence(input: {
  certificationAllowed: boolean;
  lineage: OperatorCompetencyLineage;
  replayGovernance: OperatorReplayGovernanceCompetency;
  reviewProficiency: OperatorReviewProficiency;
  survivability: OperatorCertificationSurvivability;
  operatorDrift: OperatorDriftSignal;
  ambiguityHandled: boolean;
  ambiguityCount: number;
}): OperatorCertificationConfidence {
  const basis: string[] = [];
  let score = 10;

  if (input.lineage.timeline.length >= MIN_LINEAGE_EVENTS) {
    score += 20;
    basis.push('training_lineage_reconstructable');
  }

  if (input.replayGovernance.understandingMeasured) {
    score += 25;
    basis.push('replay_governance_assessment_passed');
  }

  if (
    input.reviewProficiency.score >= CERTIFICATION_THRESHOLD
    && input.reviewProficiency.evidenceRefs.length >= MIN_EVIDENCE_REFS
  ) {
    score += 20;
    basis.push('institutional_review_simulation_passed');
  }

  if (input.ambiguityHandled) {
    score += 10;
    basis.push('ambiguity_outcomes_preserved');
  }

  if (input.survivability.replaySurvivable) {
    score += 15;
    basis.push('certification_replay_survivable');
  }

  if (!input.operatorDrift.detected) {
    score += 5;
    basis.push('operator_drift_absent');
  } else {
    basis.push('operator_drift_contained');
  }

  score = Math.max(0, Math.min(100, score - input.ambiguityCount * 2));

  const label: OperatorCertificationConfidence['label'] = input.certificationAllowed
    ? score >= CERTIFICATION_THRESHOLD
      ? 'HIGH_EVIDENCE'
      : 'PARTIAL_EVIDENCE'
    : 'BLOCKED';

  return {
    score,
    label,
    basis,
    confidenceHash: sha256ForPayload({
      schema: 'vitalcv.operator-certification-confidence.v1',
      score,
      label,
      basis,
    }),
  };
}

export function evaluateOperatorCertification(
  input: EvaluateOperatorCertificationInput,
): OperatorCertificationResult {
  const trainingLineage = buildOperatorCompetencyLineage({
    operatorId: input.operatorId,
    institutionId: input.institutionId,
    events: input.events,
  });
  const replayGovernance = evaluateReplayGovernance(input.events);
  const reviewProficiency = evaluateReviewProficiency(input.events);
  const operatorDrift = evaluateOperatorDrift(input);
  const ambiguities = cleanAmbiguities(input.events);
  const ambiguityHandled = ambiguityHandlingPasses(input.events, ambiguities);
  const survivability = buildSurvivability({
    lineage: trainingLineage,
    replayGovernance,
    operatorDrift,
  });
  const blockers = buildBlockers({
    lineage: trainingLineage,
    replayGovernance,
    reviewProficiency,
    survivability,
    operatorDrift,
    ambiguityHandled,
  });
  const certificationAllowed = blockers.length === 0;
  const status: OperatorCertificationStatus = certificationAllowed
    ? 'CERTIFIED'
    : 'CERTIFICATION_BLOCKED';
  const confidence = buildConfidence({
    certificationAllowed,
    lineage: trainingLineage,
    replayGovernance,
    reviewProficiency,
    survivability,
    operatorDrift,
    ambiguityHandled,
    ambiguityCount: ambiguities.length,
  });
  const body = {
    schema: 'vitalcv.operator-certification.v1' as const,
    operatorId: input.operatorId,
    institutionId: input.institutionId,
    evaluatedAt: input.evaluatedAt,
    policyVersion: input.policyVersion,
    status,
    certificationAllowed,
    failClosed: !certificationAllowed,
    blockers,
    ambiguities,
    ambiguityPreserved: ambiguities.every((ambiguity) =>
      trainingLineage.timeline.some((entry) => entry.ambiguity === ambiguity),
    ),
    trainingLineage,
    replayGovernance,
    reviewProficiency,
    survivability,
    operatorDrift,
    confidence,
  };

  return {
    ...body,
    certificationHash: sha256ForPayload(body),
  };
}

export function evaluateOperatorCertificationGate(input: {
  certification: OperatorCertificationResult;
}): OperatorCertificationGateResult {
  const { certification } = input;
  const gates: OperatorCertificationGateVerdict[] = [
    {
      id: 'competency_lineage_reconstructable',
      pass:
        certification.trainingLineage.timeline.length >= MIN_LINEAGE_EVENTS
        && /^[a-f0-9]{64}$/.test(certification.trainingLineage.lineageHash),
      reason: 'Operator competency lineage must be deterministic and reconstructable.',
    },
    {
      id: 'replay_governance_measurable',
      pass:
        certification.replayGovernance.understandingMeasured
        && certification.replayGovernance.score >= CERTIFICATION_THRESHOLD,
      reason: 'Replay-governance understanding must be measured above certification threshold.',
    },
    {
      id: 'ambiguity_preserved',
      pass: certification.ambiguityPreserved,
      reason: 'Certification outcomes must preserve ambiguity instead of normalizing it away.',
    },
    {
      id: 'fail_closed_certification',
      pass:
        certification.certificationAllowed
        && !certification.failClosed
        && certification.status === 'CERTIFIED',
      reason: 'CI passes only for certifiable operators; unsafe outcomes must fail closed.',
    },
    {
      id: 'training_timeline_visible',
      pass:
        Boolean(certification.trainingLineage.firstOccurredAt)
        && Boolean(certification.trainingLineage.lastOccurredAt)
        && certification.trainingLineage.firstOccurredAt !== certification.trainingLineage.lastOccurredAt,
      reason: 'Institutional training must remain longitudinally visible.',
    },
    {
      id: 'operator_drift_detectable',
      pass:
        !certification.operatorDrift.detected
        || certification.operatorDrift.containment === 'DRIFT_CONTAINED',
      reason: 'Operator governance drift must be detectable and contained.',
    },
    {
      id: 'certification_replay_survivable',
      pass:
        certification.certificationAllowed
        && certification.survivability.replaySurvivable
        && /^[a-f0-9]{64}$/.test(certification.survivability.survivabilityHash),
      reason: 'Certification must replay from lineage and competency evidence.',
    },
  ];
  const failedGateIds = gates
    .filter((gate) => !gate.pass)
    .map((gate) => gate.id);

  return {
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };
}

function cloneEvent(
  event: OperatorTrainingEvent,
  overrides: Partial<OperatorTrainingEvent>,
): OperatorTrainingEvent {
  return {
    ...event,
    evidenceRefs: [...event.evidenceRefs],
    ...overrides,
  };
}

export function runOperatorCertificationChaosSimulations(
  input: RunOperatorCertificationChaosInput,
): OperatorCertificationChaosResult {
  const scenarios: OperatorCertificationChaosScenario[] = [
    'BASELINE',
    'REPLAY_MISUNDERSTANDING',
    'LINEAGE_GAP',
    'REVIEW_PROFICIENCY_DROP',
    'TRAINING_AMBIGUITY',
    'OPERATOR_DRIFT',
  ];

  const verdicts = scenarios.map((scenario): OperatorCertificationChaosVerdict => {
    const events = (() => {
      if (scenario === 'LINEAGE_GAP') {
        return input.baselineEvents.slice(0, 1);
      }

      if (scenario === 'REPLAY_MISUNDERSTANDING') {
        return input.baselineEvents.map((event) =>
          isReplayEvent(event)
            ? cloneEvent(event, {
                score: 62,
                outcome: 'FAIL',
                ambiguity: 'operator confused replay warning with acceptance denial',
              })
            : event,
        );
      }

      if (scenario === 'REVIEW_PROFICIENCY_DROP') {
        return input.baselineEvents.map((event) =>
          isReviewEvent(event)
            ? cloneEvent(event, {
                score: 54,
                outcome: 'FAIL',
                ambiguity: 'operator missed institutional review escalation',
              })
            : event,
        );
      }

      if (scenario === 'TRAINING_AMBIGUITY') {
        return input.baselineEvents.map((event) =>
          isAmbiguityEvent(event)
            ? cloneEvent(event, {
                score: 60,
                outcome: 'FAIL',
                evidenceRefs: ['ambiguous-training-note'],
                ambiguity: 'operator left replay exception category unresolved',
              })
            : event,
        );
      }

      return input.baselineEvents;
    })();
    const currentReplayGovernanceDigest =
      scenario === 'OPERATOR_DRIFT'
        ? `${input.expectedReplayGovernanceDigest}-drifted`
        : input.expectedReplayGovernanceDigest;
    const certification = evaluateOperatorCertification({
      operatorId: input.operatorId,
      institutionId: input.institutionId,
      evaluatedAt: input.evaluatedAt,
      policyVersion: input.policyVersion,
      events,
      expectedReplayGovernanceDigest: input.expectedReplayGovernanceDigest,
      currentReplayGovernanceDigest,
    });
    const gate = evaluateOperatorCertificationGate({ certification });
    const signalSurfaced =
      scenario === 'BASELINE'
        ? gate.pass
        : certification.failClosed && !gate.pass;

    return {
      scenario,
      signalSurfaced,
      status: certification.status,
      failedGateIds: gate.failedGateIds,
    };
  });
  const surfacedCount = verdicts.filter((verdict) => verdict.signalSurfaced).length;

  return {
    verdicts,
    summary: {
      totalScenarios: verdicts.length,
      surfacedCount,
      silentCount: verdicts.length - surfacedCount,
    },
  };
}
