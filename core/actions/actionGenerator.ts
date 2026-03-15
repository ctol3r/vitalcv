import type { PredictionInsight } from '../predictions/predictionEngine';
import type { ActionCandidate, ActionEvidence, ActionStoryline, ActionTargetEntity, ActionType } from './actionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function normalizeSeverity(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 1;
    case 'high':
      return 0.82;
    case 'medium':
      return 0.58;
    case 'low':
      return 0.35;
    default:
      return 0.4;
  }
}

function statementExists(reasons: string[], value: string): boolean {
  return reasons.some((reason) => reason.toLowerCase() === value.toLowerCase());
}

function addReason(reasons: string[], value: string): void {
  if (!value || statementExists(reasons, value)) {
    return;
  }

  reasons.push(value);
}

function evidenceFromPrediction(prediction: PredictionInsight): ActionEvidence[] {
  return prediction.evidenceSignals.slice(0, 3).map((signal) => ({
    label: signal.label,
    snippet: `${signal.label.replace(/_/g, ' ')} = ${signal.value}`,
    source: signal.source ?? null,
  }));
}

function targetLabel(targetEntity: ActionTargetEntity): string {
  return targetEntity.entityLabel ?? targetEntity.entityId;
}

function buildStorylineReasons(storyline: ActionStoryline): string[] {
  const reasons: string[] = [];
  const metadata = storyline.metadata ?? {};
  const scoreDelta = typeof metadata.scoreDelta === 'number' ? metadata.scoreDelta : null;
  const staleDimensions = Array.isArray(metadata.staleDimensions) ? metadata.staleDimensions.length : 0;
  const conflicts = Array.isArray(metadata.conflicts) ? metadata.conflicts.length : 0;
  const citationCount = typeof metadata.citationCount === 'number' ? metadata.citationCount : 0;
  const pressureScore = typeof metadata.pressureScore === 'number' ? metadata.pressureScore : null;

  if (scoreDelta !== null && scoreDelta < 0) {
    addReason(reasons, `trust score dropped ${Math.abs(scoreDelta).toFixed(1)} points`);
  }
  if (staleDimensions > 0) {
    addReason(reasons, 'verification data is stale');
  }
  if (conflicts > 0 || storyline.findingTypes.includes('divergence')) {
    addReason(reasons, 'authoritative sources disagree');
  }
  if (storyline.findingTypes.includes('research_momentum')) {
    addReason(reasons, citationCount >= 100 ? 'research momentum is accelerating with elevated citations' : 'research momentum is accelerating');
  }
  if (storyline.findingTypes.includes('network_emergence')) {
    addReason(reasons, 'a denser collaboration cluster is forming');
  }
  if (storyline.findingTypes.includes('workforce_pressure')) {
    if (typeof metadata.state === 'string' && typeof metadata.specialty === 'string') {
      addReason(reasons, `${metadata.state} ${metadata.specialty} demand is outpacing supply`);
    } else {
      addReason(reasons, 'workforce demand is outpacing supply');
    }
  }
  if (pressureScore !== null && pressureScore >= 60) {
    addReason(reasons, `pressure score reached ${pressureScore.toFixed(0)}`);
  }
  if (storyline.findingTypes.includes('industry_influence')) {
    addReason(reasons, 'industry-payment concentration is elevated');
  }

  if (reasons.length === 0) {
    addReason(reasons, storyline.title.toLowerCase());
  }

  return reasons;
}

function buildStorylineAction(
  storyline: ActionStoryline,
  actionType: ActionType,
  recommendedAction: string,
  overrides?: Partial<ActionCandidate>,
): ActionCandidate {
  const reasons = buildStorylineReasons(storyline);
  const severityWeight = normalizeSeverity(storyline.severity);
  const metadata = storyline.metadata ?? {};
  const entityImportance = clamp01(
    typeof metadata.entityImportance === 'number'
      ? metadata.entityImportance
      : typeof metadata.graphCentrality === 'number'
        ? metadata.graphCentrality
        : 0.45,
  );

  return {
    actionType,
    targetEntity: storyline.targetEntity,
    storylineKey: storyline.storylineKey,
    sourceFindingIds: [...storyline.findingIds],
    predictionIds: [],
    recommendedAction,
    reasonFragments: reasons,
    evidence: storyline.supportingEvidence.slice(0, 4),
    baseConfidence: clamp01(Math.max(storyline.confidence, 0.55)),
    riskWeight: severityWeight,
    urgencyWeight: severityWeight,
    opportunityWeight: 0,
    entityImportance,
    recencyWeight: 0.75,
    metadata: {
      storylineType: storyline.storylineType,
      findingTypes: storyline.findingTypes,
      ...metadata,
    },
    ...overrides,
  };
}

function mergeCandidates(left: ActionCandidate, right: ActionCandidate): ActionCandidate {
  const reasonFragments = [...left.reasonFragments];
  for (const reason of right.reasonFragments) {
    addReason(reasonFragments, reason);
  }

  const evidence = [...left.evidence];
  for (const item of right.evidence) {
    if (!evidence.some((existing) => existing.label === item.label && existing.snippet === item.snippet)) {
      evidence.push(item);
    }
  }

  return {
    ...left,
    sourceFindingIds: [...new Set([...left.sourceFindingIds, ...right.sourceFindingIds])],
    predictionIds: [...new Set([...left.predictionIds, ...right.predictionIds])],
    reasonFragments,
    evidence: evidence.slice(0, 5),
    baseConfidence: Math.max(left.baseConfidence, right.baseConfidence),
    riskWeight: Math.max(left.riskWeight, right.riskWeight),
    urgencyWeight: Math.max(left.urgencyWeight, right.urgencyWeight),
    opportunityWeight: Math.max(left.opportunityWeight, right.opportunityWeight),
    entityImportance: Math.max(left.entityImportance, right.entityImportance),
    recencyWeight: Math.max(left.recencyWeight, right.recencyWeight),
    metadata: {
      ...left.metadata,
      ...right.metadata,
    },
  };
}

function dedupeCandidates(candidates: ActionCandidate[]): ActionCandidate[] {
  const merged = new Map<string, ActionCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.actionType,
      candidate.targetEntity.entityType,
      candidate.targetEntity.entityId,
    ].join(':');
    const existing = merged.get(key);
    merged.set(key, existing ? mergeCandidates(existing, candidate) : candidate);
  }

  return [...merged.values()];
}

function storylineActions(storyline: ActionStoryline): ActionCandidate[] {
  const actions: ActionCandidate[] = [];
  const type = storyline.storylineType.toUpperCase();
  const severityWeight = normalizeSeverity(storyline.severity);

  if (type.includes('TRUST') || type.includes('FRESHNESS') || type.includes('COMPLIANCE')) {
    actions.push(buildStorylineAction(
      storyline,
      'RUN_VERIFICATION',
      `Run verification for ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: severityWeight,
        urgencyWeight: Math.max(severityWeight, 0.65),
      },
    ));
  }

  if (type.includes('TRUST') || type.includes('COMPLIANCE') || type.includes('INDUSTRY')) {
    actions.push(buildStorylineAction(
      storyline,
      'INVESTIGATE_PROVIDER',
      `Investigate ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: Math.max(severityWeight, 0.58),
        urgencyWeight: Math.max(severityWeight, 0.55),
      },
    ));
  }

  if (type.includes('NETWORK') || type.includes('RISING_INVESTIGATOR')) {
    actions.push(buildStorylineAction(
      storyline,
      'MONITOR_PROVIDER',
      `Monitor ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: 0.35,
        urgencyWeight: 0.45,
        opportunityWeight: 0.35,
      },
    ));
  }

  if (type.includes('RISING_INVESTIGATOR') || type.includes('WORKFORCE')) {
    actions.push(buildStorylineAction(
      storyline,
      'COMPARE_WITH_PEERS',
      `Compare ${targetLabel(storyline.targetEntity)} with peers`,
      {
        riskWeight: 0.25,
        urgencyWeight: 0.4,
        opportunityWeight: 0.6,
      },
    ));
  }

  if (type.includes('WORKFORCE')) {
    actions.push(buildStorylineAction(
      storyline,
      'ALERT_TEAM',
      `Alert the team about ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: 0.2,
        urgencyWeight: 0.55,
        opportunityWeight: 0.7,
      },
    ));
    actions.push(buildStorylineAction(
      storyline,
      'EXPORT_REPORT',
      `Export a report for ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: 0.15,
        urgencyWeight: 0.35,
        opportunityWeight: 0.72,
      },
    ));
  }

  if (storyline.severity.toLowerCase() === 'critical') {
    actions.push(buildStorylineAction(
      storyline,
      'ESCALATE_RISK',
      `Escalate risk for ${targetLabel(storyline.targetEntity)}`,
      {
        riskWeight: 1,
        urgencyWeight: 1,
      },
    ));
  }

  return actions;
}

function predictionActions(prediction: PredictionInsight): ActionCandidate[] {
  const target = prediction.targetEntity;
  const label = targetLabel(target);
  const reasons = prediction.evidenceSignals
    .slice(0, 3)
    .map((signal) => `${signal.label.replace(/_/g, ' ')} = ${signal.value}`);
  const evidence = evidenceFromPrediction(prediction);
  const probability = clamp01(prediction.probability);
  const confidence = clamp01(prediction.confidence);

  const build = (
    actionType: ActionType,
    recommendedAction: string,
    overrides?: Partial<ActionCandidate>,
  ): ActionCandidate => ({
    actionType,
    targetEntity: target,
    storylineKey: null,
    sourceFindingIds: [],
    predictionIds: [prediction.predictionId],
    recommendedAction,
    reasonFragments: reasons,
    evidence,
    baseConfidence: confidence,
    riskWeight: 0.4,
    urgencyWeight: probability,
    opportunityWeight: 0.25,
    entityImportance: 0.55,
    recencyWeight: 0.7,
    metadata: {
      predictionType: prediction.predictionType,
      timeHorizon: prediction.timeHorizon,
    },
    ...overrides,
  });

  switch (prediction.predictionType) {
    case 'TRUST_SCORE_DECLINE':
      return [
        build('RUN_VERIFICATION', `Run verification for ${label}`, {
          riskWeight: Math.max(probability, 0.6),
          urgencyWeight: Math.max(probability, 0.68),
        }),
        ...(probability >= 0.75 ? [
          build('ESCALATE_RISK', `Escalate risk for ${label}`, {
            riskWeight: Math.max(probability, 0.85),
            urgencyWeight: Math.max(probability, 0.82),
          }),
        ] : []),
      ];
    case 'EMERGING_INVESTIGATOR':
      return [
        build('COMPARE_WITH_PEERS', `Compare ${label} with peers`, {
          riskWeight: 0.2,
          urgencyWeight: 0.45,
          opportunityWeight: Math.max(probability, 0.65),
        }),
        build('ALERT_TEAM', `Alert the team about ${label}`, {
          riskWeight: 0.18,
          urgencyWeight: 0.42,
          opportunityWeight: Math.max(probability, 0.62),
        }),
      ];
    case 'INSTITUTION_RESEARCH_GROWTH':
      return [
        build('ALERT_TEAM', `Alert the team about ${label}`, {
          riskWeight: 0.15,
          urgencyWeight: 0.4,
          opportunityWeight: Math.max(probability, 0.72),
        }),
        build('EXPORT_REPORT', `Export a report for ${label}`, {
          riskWeight: 0.1,
          urgencyWeight: 0.32,
          opportunityWeight: Math.max(probability, 0.78),
        }),
      ];
    case 'NETWORK_CLUSTER_EXPANSION':
      return [
        build('MONITOR_PROVIDER', `Monitor ${label}`, {
          riskWeight: 0.28,
          urgencyWeight: 0.48,
          opportunityWeight: 0.34,
        }),
      ];
    case 'WORKFORCE_SHORTAGE_ESCALATION':
      return [
        build('ALERT_TEAM', `Alert the team about ${label}`, {
          riskWeight: 0.25,
          urgencyWeight: Math.max(probability, 0.6),
          opportunityWeight: Math.max(probability, 0.75),
        }),
        build('EXPORT_REPORT', `Export a report for ${label}`, {
          riskWeight: 0.18,
          urgencyWeight: 0.35,
          opportunityWeight: Math.max(probability, 0.8),
        }),
      ];
  }
}

export function generateActionCandidates(
  storylines: readonly ActionStoryline[],
  predictions: readonly PredictionInsight[],
  _now: string,
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];

  for (const storyline of storylines) {
    candidates.push(...storylineActions(storyline));
  }

  for (const prediction of predictions) {
    candidates.push(...predictionActions(prediction));
  }

  return dedupeCandidates(candidates);
}
