import { createHash } from 'node:crypto';

export type DecisionRecommendation =
  | 'VERIFY_CREDENTIAL'
  | 'ESCALATE_RISK'
  | 'MONITOR_PROVIDER'
  | 'INVESTIGATE_NETWORK'
  | 'REVIEW_INSTITUTION'
  | 'TRACK_SPECIALTY';

export type DecisionPriority = 'urgent' | 'high' | 'medium' | 'low';
export type DecisionStatus = 'open' | 'resolved' | 'dismissed';

export type DecisionType =
  | 'CREDENTIAL_VERIFICATION_REVIEW'
  | 'PROVIDER_RISK_ESCALATION'
  | 'PROVIDER_TRAJECTORY_WATCH'
  | 'NETWORK_CLUSTER_INVESTIGATION'
  | 'INSTITUTION_RESEARCH_REVIEW'
  | 'SPECIALTY_PRESSURE_TRACKING';

export interface DecisionTargetEntity {
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
}

export interface DecisionEntityLink extends DecisionTargetEntity {
  relationship?: string | null;
}

export interface DecisionSupportingSignal {
  kind: 'finding' | 'storyline' | 'prediction' | 'metric';
  signalId: string;
  label: string;
  value?: string | number | null;
  source?: string | null;
  observedAt?: string | null;
  confidence?: number;
}

export interface DecisionFinding {
  findingId: string;
  findingType: string;
  severity: string;
  title: string;
  summary: string;
  explanation: string;
  primaryEntity: DecisionTargetEntity;
  entities: DecisionEntityLink[];
  confidence: number;
  priorityScore: number;
  graphCentrality?: number;
  entityImportance?: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DecisionStoryline {
  storylineKey: string;
  storylineType: string;
  title: string;
  narrative: string;
  severity: string;
  confidence: number;
  targetEntity: DecisionTargetEntity;
  findingIds: string[];
  findingTypes: string[];
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DecisionPredictionEvidenceSignal {
  label: string;
  value: number | string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  source?: string | null;
}

export interface DecisionPrediction {
  predictionId: string;
  predictionType: string;
  targetEntity: DecisionTargetEntity;
  probability: number;
  confidence: number;
  timeHorizon: string;
  explanation: string;
  evidenceSignals: DecisionPredictionEvidenceSignal[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionResult {
  id: string;
  type: DecisionType;
  targetEntity: DecisionTargetEntity;
  recommendation: DecisionRecommendation;
  priority: DecisionPriority;
  priorityScore: number;
  confidence: number;
  explanation: string;
  supportingSignals: DecisionSupportingSignal[];
  supportingFindingIds: string[];
  supportingStorylineKeys: string[];
  supportingPredictionIds: string[];
  createdAt: string;
  updatedAt: string;
  status: DecisionStatus;
  metadata: Record<string, unknown>;
}

export interface DecisionEngineInput {
  findings: readonly DecisionFinding[];
  storylines: readonly DecisionStoryline[];
  predictions: readonly DecisionPrediction[];
  now?: string;
}

type DecisionContext = {
  targetEntity: DecisionTargetEntity;
  findings: DecisionFinding[];
  storylines: DecisionStoryline[];
  predictions: DecisionPrediction[];
  linkedFindings: DecisionFinding[];
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

function hashSeed(seed: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(seed)).digest('hex');
}

function buildDecisionId(input: {
  type: DecisionType;
  targetEntity: DecisionTargetEntity;
  recommendation: DecisionRecommendation;
  supportingFindingIds: readonly string[];
  supportingPredictionIds: readonly string[];
  supportingStorylineKeys: readonly string[];
}): string {
  return `decision_${hashSeed({
    type: input.type,
    targetEntity: input.targetEntity,
    recommendation: input.recommendation,
    supportingFindingIds: [...input.supportingFindingIds].sort(),
    supportingPredictionIds: [...input.supportingPredictionIds].sort(),
    supportingStorylineKeys: [...input.supportingStorylineKeys].sort(),
  }).slice(0, 24)}`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function severityScore(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 1;
    case 'high':
      return 0.82;
    case 'medium':
      return 0.58;
    case 'low':
      return 0.34;
    case 'info':
      return 0.22;
    default:
      return 0.28;
  }
}

function priorityFromScore(score: number): DecisionPriority {
  if (score >= 0.82) {
    return 'urgent';
  }
  if (score >= 0.64) {
    return 'high';
  }
  if (score >= 0.44) {
    return 'medium';
  }
  return 'low';
}

function entityKey(entity: DecisionTargetEntity): string {
  return `${entity.entityType}:${entity.entityId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function arrayLength(record: Record<string, unknown>, key: string): number {
  return Array.isArray(record[key]) ? record[key].length : 0;
}

function maxValue(values: Array<number | null | undefined>): number {
  return values.reduce<number>((current, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return current;
    }
    return Math.max(current, value);
  }, 0);
}

function avgValue(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function includesType(value: string, pattern: RegExp): boolean {
  return pattern.test(value.toLowerCase());
}

function predictionMetric(prediction: DecisionPrediction, label: string): number | null {
  const signal = prediction.evidenceSignals.find((item) => item.label === label);
  if (typeof signal?.value === 'number') {
    return signal.value;
  }

  if (typeof signal?.value === 'string') {
    const parsed = Number.parseFloat(signal.value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return asNumber(prediction.metadata[label]);
}

function predictionSignal(
  prediction: DecisionPrediction,
  label: string,
): DecisionSupportingSignal {
  return {
    kind: 'prediction',
    signalId: prediction.predictionId,
    label,
    value: prediction.explanation,
    source: prediction.predictionType,
    observedAt: prediction.updatedAt,
    confidence: prediction.confidence,
  };
}

function predictionEvidenceSignal(
  prediction: DecisionPrediction,
  evidenceLabel: string,
): DecisionSupportingSignal | null {
  const evidence = prediction.evidenceSignals.find((signal) => signal.label === evidenceLabel);
  if (!evidence) {
    return null;
  }

  return {
    kind: 'prediction',
    signalId: prediction.predictionId,
    label: evidence.label,
    value: evidence.value,
    source: evidence.source ?? prediction.predictionType,
    observedAt: prediction.updatedAt,
    confidence: prediction.confidence,
  };
}

function findingSignal(
  finding: DecisionFinding,
  label = finding.title,
  value: string | number | null = finding.severity,
): DecisionSupportingSignal {
  return {
    kind: 'finding',
    signalId: finding.findingId,
    label,
    value,
    source: finding.findingType,
    observedAt: finding.updatedAt,
    confidence: finding.confidence,
  };
}

function storylineSignal(
  storyline: DecisionStoryline,
  label = storyline.title,
  value: string | number | null = storyline.storylineType,
): DecisionSupportingSignal {
  return {
    kind: 'storyline',
    signalId: storyline.storylineKey,
    label,
    value,
    source: storyline.storylineType,
    observedAt: storyline.updatedAt,
    confidence: storyline.confidence,
  };
}

function metricSignal(
  signalId: string,
  label: string,
  value: string | number | null,
  source?: string | null,
): DecisionSupportingSignal {
  return {
    kind: 'metric',
    signalId,
    label,
    value,
    source: source ?? null,
  };
}

function dedupeSignals(signals: DecisionSupportingSignal[]): DecisionSupportingSignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.kind}:${signal.signalId}:${signal.label}:${String(signal.value ?? '')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sourceConfidence(
  findings: readonly DecisionFinding[],
  storylines: readonly DecisionStoryline[],
  predictions: readonly DecisionPrediction[],
): number {
  const values = [
    ...findings.map((finding) => finding.confidence),
    ...storylines.map((storyline) => storyline.confidence),
    ...predictions.map((prediction) => prediction.confidence),
  ]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)
    .slice(0, 4);

  return clamp01(avgValue(values));
}

function networkCentrality(
  findings: readonly DecisionFinding[],
  storylines: readonly DecisionStoryline[],
  predictions: readonly DecisionPrediction[],
): number {
  const predictionCentrality = predictions.map((prediction) => {
    const graphDegree = asNumber(prediction.metadata.graphDegree);
    if (graphDegree !== null) {
      return clamp01(graphDegree / 12);
    }
    const averageConfidence = asNumber(prediction.metadata.averageConfidence);
    return averageConfidence !== null ? clamp01(averageConfidence) : 0;
  });

  return clamp01(maxValue([
    ...findings.map((finding) => finding.graphCentrality ?? asNumber(finding.metadata.graphCentrality)),
    ...storylines.map((storyline) => asNumber(storyline.metadata.graphCentrality)),
    ...predictionCentrality,
  ]));
}

function predictionStateScore(predictions: readonly DecisionPrediction[]): number {
  return clamp01(maxValue(predictions.map((prediction) => prediction.probability)));
}

function highestSeverity(
  findings: readonly DecisionFinding[],
  storylines: readonly DecisionStoryline[],
): number {
  return clamp01(maxValue([
    ...findings.map((finding) => severityScore(finding.severity)),
    ...storylines.map((storyline) => severityScore(storyline.severity)),
  ]));
}

function buildDecision(params: {
  type: DecisionType;
  targetEntity: DecisionTargetEntity;
  recommendation: DecisionRecommendation;
  explanation: string;
  findings: DecisionFinding[];
  storylines: DecisionStoryline[];
  predictions: DecisionPrediction[];
  supportingSignals: DecisionSupportingSignal[];
  now: string;
  metadata?: Record<string, unknown>;
}): DecisionResult {
  const confidence = sourceConfidence(params.findings, params.storylines, params.predictions);
  const severity = highestSeverity(params.findings, params.storylines);
  const predictionScore = predictionStateScore(params.predictions);
  const centrality = networkCentrality(params.findings, params.storylines, params.predictions);
  const priorityScore = clamp01(
    (severity * 0.4)
    + (predictionScore * 0.25)
    + (centrality * 0.15)
    + (confidence * 0.2),
  );
  const priority = priorityFromScore(priorityScore);
  const supportingFindingIds = [...new Set(params.findings.map((finding) => finding.findingId))];
  const supportingStorylineKeys = [...new Set(params.storylines.map((storyline) => storyline.storylineKey))];
  const supportingPredictionIds = [...new Set(params.predictions.map((prediction) => prediction.predictionId))];

  return {
    id: buildDecisionId({
      type: params.type,
      targetEntity: params.targetEntity,
      recommendation: params.recommendation,
      supportingFindingIds,
      supportingPredictionIds,
      supportingStorylineKeys,
    }),
    type: params.type,
    targetEntity: params.targetEntity,
    recommendation: params.recommendation,
    priority,
    priorityScore,
    confidence,
    explanation: params.explanation,
    supportingSignals: dedupeSignals(params.supportingSignals).slice(0, 8),
    supportingFindingIds,
    supportingStorylineKeys,
    supportingPredictionIds,
    createdAt: params.now,
    updatedAt: params.now,
    status: 'open',
    metadata: {
      ...params.metadata,
      severityScore: severity,
      predictionStateScore: predictionScore,
      networkCentrality: centrality,
    },
  };
}

function providerTrajectoryState(context: DecisionContext): 'rising' | 'declining' | 'stable' {
  const risingPrediction = context.predictions.some((prediction) =>
    prediction.predictionType === 'EMERGING_INVESTIGATOR' && prediction.probability >= 0.55,
  );
  const risingFinding = context.findings.some((finding) => finding.findingType === 'research_momentum');
  if (risingPrediction || risingFinding) {
    return 'rising';
  }

  const decliningPrediction = context.predictions.some((prediction) =>
    prediction.predictionType === 'TRUST_SCORE_DECLINE' && prediction.probability >= 0.55,
  );
  const decliningFinding = context.findings.some((finding) =>
    ['trust_decline', 'divergence', 'compliance', 'exclusion'].includes(finding.findingType),
  );
  if (decliningPrediction || decliningFinding) {
    return 'declining';
  }

  return 'stable';
}

function specialtyPressureScore(context: DecisionContext): number {
  const findingScores = context.findings
    .filter((finding) => finding.findingType === 'workforce_pressure')
    .map((finding) => asNumber(finding.metadata.pressureScore) ?? 0);
  const storylineScores = context.storylines
    .filter((storyline) => includesType(storyline.storylineType, /\bworkforce\b/))
    .map((storyline) => asNumber(storyline.metadata.pressureScore) ?? 0);

  return maxValue([...findingScores, ...storylineScores]);
}

function trustRiskIncreasing(context: DecisionContext): boolean {
  const riskFinding = context.findings.some((finding) =>
    ['trust_decline', 'divergence', 'compliance', 'exclusion'].includes(finding.findingType)
      && severityScore(finding.severity) >= severityScore('high'),
  );
  const riskPrediction = context.predictions.some((prediction) =>
    prediction.predictionType === 'TRUST_SCORE_DECLINE' && prediction.probability >= 0.55,
  );
  return riskFinding || riskPrediction;
}

function credentialVerificationGap(context: DecisionContext): boolean {
  return context.findings.some((finding) => {
    if (!['trust_decline', 'divergence', 'compliance', 'freshness'].includes(finding.findingType)) {
      return false;
    }
    const metadata = finding.metadata;
    return arrayLength(metadata, 'staleDimensions') > 0
      || arrayLength(metadata, 'conflicts') > 0
      || arrayLength(metadata, 'institutionMismatch') > 0;
  }) || context.predictions.some((prediction) =>
    prediction.predictionType === 'TRUST_SCORE_DECLINE'
      && ((predictionMetric(prediction, 'stale_sources') ?? 0) > 0
        || (predictionMetric(prediction, 'divergence_signals') ?? 0) > 0),
  );
}

function networkShiftEmerging(context: DecisionContext): boolean {
  return context.findings.some((finding) => finding.findingType === 'network_emergence')
    || context.storylines.some((storyline) =>
      includesType(storyline.storylineType, /\bnetwork\b/)
      || storyline.findingTypes.includes('network_emergence'),
    )
    || context.predictions.some((prediction) =>
      prediction.predictionType === 'NETWORK_CLUSTER_EXPANSION' && prediction.probability >= 0.5,
    );
}

function trialLeadershipSignal(context: DecisionContext): boolean {
  return context.findings.some((finding) => {
    if (finding.findingType !== 'research_momentum') {
      return false;
    }
    return (asNumber(finding.metadata.recentTrialCount) ?? 0) > 0
      || (asNumber(finding.metadata.recentGrantCount) ?? 0) > 0
      || (asNumber(finding.metadata.citationCount) ?? 0) >= 100;
  }) || context.predictions.some((prediction) =>
    prediction.predictionType === 'EMERGING_INVESTIGATOR'
      && ((predictionMetric(prediction, 'recent_trials') ?? 0) > 0
        || (predictionMetric(prediction, 'recent_grants') ?? 0) > 0),
  );
}

function industryFundingSignal(context: DecisionContext): boolean {
  return context.findings.some((finding) => finding.findingType === 'industry_influence')
    || context.storylines.some((storyline) => storyline.findingTypes.includes('industry_influence'));
}

function providerDecisions(context: DecisionContext, now: string): DecisionResult[] {
  const decisions: DecisionResult[] = [];
  const providerLabel = context.targetEntity.entityLabel ?? context.targetEntity.entityId;
  const trajectory = providerTrajectoryState(context);
  const pressureScore = specialtyPressureScore(context);
  const trustRisk = trustRiskIncreasing(context);
  const hasCredentialGap = credentialVerificationGap(context);
  const networkShift = networkShiftEmerging(context);
  const trialLeadership = trialLeadershipSignal(context);
  const industryFunding = industryFundingSignal(context);

  if (hasCredentialGap) {
    const trustPredictions = context.predictions.filter((prediction) => prediction.predictionType === 'TRUST_SCORE_DECLINE');
    const trustFindings = context.findings.filter((finding) =>
      ['trust_decline', 'divergence', 'compliance', 'freshness'].includes(finding.findingType),
    );
    const supportingSignals = [
      ...trustFindings.slice(0, 2).map((finding) => findingSignal(finding)),
      ...trustPredictions.slice(0, 1).map((prediction) => predictionSignal(prediction, prediction.predictionType)),
      ...trustPredictions.slice(0, 1).map((prediction) => predictionEvidenceSignal(prediction, 'stale_sources')).filter((signal): signal is DecisionSupportingSignal => signal !== null),
      ...trustPredictions.slice(0, 1).map((prediction) => predictionEvidenceSignal(prediction, 'divergence_signals')).filter((signal): signal is DecisionSupportingSignal => signal !== null),
    ];
    const staleCount = maxValue(trustPredictions.map((prediction) => predictionMetric(prediction, 'stale_sources')));
    const divergenceCount = maxValue(trustPredictions.map((prediction) => predictionMetric(prediction, 'divergence_signals')));
    decisions.push(buildDecision({
      type: 'CREDENTIAL_VERIFICATION_REVIEW',
      targetEntity: context.targetEntity,
      recommendation: 'VERIFY_CREDENTIAL',
      explanation: `${providerLabel} should be re-verified because stale or conflicting credential signals remain active${staleCount > 0 ? ` (${staleCount} stale source signal${staleCount === 1 ? '' : 's'})` : ''}${divergenceCount > 0 ? ` and ${divergenceCount} divergence signal${divergenceCount === 1 ? '' : 's'} are unresolved` : ''}.`,
      findings: trustFindings,
      storylines: context.storylines.filter((storyline) =>
        storyline.findingTypes.some((findingType) => ['trust_decline', 'divergence', 'compliance', 'freshness'].includes(findingType)),
      ),
      predictions: trustPredictions,
      supportingSignals,
      now,
      metadata: {
        providerTrajectory: trajectory,
        specialtyPressure: pressureScore,
      },
    }));
  }

  if (trajectory === 'declining' && trustRisk) {
    const riskFindings = context.findings.filter((finding) =>
      ['trust_decline', 'divergence', 'compliance', 'exclusion'].includes(finding.findingType),
    );
    const riskPredictions = context.predictions.filter((prediction) => prediction.predictionType === 'TRUST_SCORE_DECLINE');
    decisions.push(buildDecision({
      type: 'PROVIDER_RISK_ESCALATION',
      targetEntity: context.targetEntity,
      recommendation: 'ESCALATE_RISK',
      explanation: `${providerLabel} requires escalation because the provider trajectory is declining while trust-risk signals are still increasing.`,
      findings: riskFindings,
      storylines: context.storylines.filter((storyline) =>
        storyline.findingTypes.some((findingType) => ['trust_decline', 'divergence', 'compliance', 'exclusion'].includes(findingType)),
      ),
      predictions: riskPredictions,
      supportingSignals: [
        ...riskFindings.slice(0, 2).map((finding) => findingSignal(finding)),
        ...riskPredictions.slice(0, 1).map((prediction) => predictionSignal(prediction, prediction.predictionType)),
        ...riskPredictions.slice(0, 1).map((prediction) => predictionEvidenceSignal(prediction, 'trust_score_delta')).filter((signal): signal is DecisionSupportingSignal => signal !== null),
      ],
      now,
      metadata: {
        providerTrajectory: trajectory,
      },
    }));
  }

  if (trajectory === 'rising' && pressureScore >= 80) {
    const pressureFindings = context.findings.filter((finding) => finding.findingType === 'workforce_pressure');
    const risingPredictions = context.predictions.filter((prediction) => prediction.predictionType === 'EMERGING_INVESTIGATOR');
    decisions.push(buildDecision({
      type: 'PROVIDER_TRAJECTORY_WATCH',
      targetEntity: context.targetEntity,
      recommendation: 'MONITOR_PROVIDER',
      explanation: `${providerLabel} should be monitored because the provider trajectory is rising while specialty pressure remains severe.`,
      findings: pressureFindings,
      storylines: context.storylines.filter((storyline) =>
        storyline.findingTypes.includes('workforce_pressure') || storyline.findingTypes.includes('research_momentum'),
      ),
      predictions: risingPredictions,
      supportingSignals: [
        ...risingPredictions.slice(0, 1).map((prediction) => predictionSignal(prediction, prediction.predictionType)),
        ...risingPredictions.slice(0, 1).map((prediction) => predictionEvidenceSignal(prediction, 'recent_trials')).filter((signal): signal is DecisionSupportingSignal => signal !== null),
        ...pressureFindings.slice(0, 1).map((finding) => findingSignal(finding)),
        metricSignal(entityKey(context.targetEntity), 'specialty_pressure', pressureScore, 'WORKFORCE_PRESSURE'),
      ],
      now,
      metadata: {
        providerTrajectory: trajectory,
        specialtyPressure: pressureScore,
      },
    }));
  }

  if (networkShift || (trialLeadership && industryFunding)) {
    const networkFindings = context.findings.filter((finding) =>
      ['network_emergence', 'research_momentum', 'industry_influence'].includes(finding.findingType),
    );
    const networkPredictions = context.predictions.filter((prediction) =>
      ['NETWORK_CLUSTER_EXPANSION', 'EMERGING_INVESTIGATOR'].includes(prediction.predictionType),
    );
    decisions.push(buildDecision({
      type: 'NETWORK_CLUSTER_INVESTIGATION',
      targetEntity: context.targetEntity,
      recommendation: 'INVESTIGATE_NETWORK',
      explanation: `${providerLabel} should trigger a network investigation because collaboration signals are shifting${trialLeadership && industryFunding ? ' and the surrounding research or funding pattern is intensifying' : ''}.`,
      findings: networkFindings,
      storylines: context.storylines.filter((storyline) =>
        storyline.findingTypes.some((findingType) => ['network_emergence', 'research_momentum', 'industry_influence'].includes(findingType)),
      ),
      predictions: networkPredictions,
      supportingSignals: [
        ...networkFindings.slice(0, 3).map((finding) => findingSignal(finding)),
        ...networkPredictions.slice(0, 1).map((prediction) => predictionSignal(prediction, prediction.predictionType)),
        ...networkPredictions.slice(0, 1).map((prediction) => predictionEvidenceSignal(prediction, 'connection_growth')).filter((signal): signal is DecisionSupportingSignal => signal !== null),
      ],
      now,
      metadata: {
        providerTrajectory: trajectory,
        networkShift,
        trialLeadership,
        industryFunding,
      },
    }));
  }

  return decisions;
}

function institutionDecisions(context: DecisionContext, now: string): DecisionResult[] {
  const growthPredictions = context.predictions.filter((prediction) =>
    prediction.predictionType === 'INSTITUTION_RESEARCH_GROWTH' && prediction.probability >= 0.55,
  );
  if (growthPredictions.length === 0) {
    return [];
  }

  const institutionLabel = context.targetEntity.entityLabel ?? context.targetEntity.entityId;
  const linkedRiskFindings = context.linkedFindings.filter((finding) =>
    ['divergence', 'trust_decline', 'compliance', 'exclusion'].includes(finding.findingType),
  );
  const leadingPrediction = growthPredictions[0]!;
  const contributingProviders = predictionMetric(leadingPrediction, 'contributing_providers') ?? asNumber(leadingPrediction.metadata.contributingProviders) ?? 0;
  const growth = predictionMetric(leadingPrediction, 'research_growth') ?? asNumber(leadingPrediction.metadata.researchGrowth) ?? 0;

  return [buildDecision({
    type: 'INSTITUTION_RESEARCH_REVIEW',
    targetEntity: context.targetEntity,
    recommendation: 'REVIEW_INSTITUTION',
    explanation: `${institutionLabel} should be reviewed because institution-linked research activity is accelerating${contributingProviders > 0 ? ` across ${contributingProviders} contributing provider${contributingProviders === 1 ? '' : 's'}` : ''}${linkedRiskFindings.length > 0 ? ' and there are active linked provider risk signals' : ''}.`,
    findings: linkedRiskFindings,
    storylines: context.storylines,
    predictions: growthPredictions,
    supportingSignals: [
      predictionSignal(leadingPrediction, leadingPrediction.predictionType),
      ...[
        predictionEvidenceSignal(leadingPrediction, 'research_growth'),
        predictionEvidenceSignal(leadingPrediction, 'contributing_providers'),
        predictionEvidenceSignal(leadingPrediction, 'lead_investigators'),
      ].filter((signal): signal is DecisionSupportingSignal => signal !== null),
      ...linkedRiskFindings.slice(0, 2).map((finding) => findingSignal(finding)),
      metricSignal(entityKey(context.targetEntity), 'linked_provider_risk_count', linkedRiskFindings.length, 'INVESTIGATOR_FINDINGS'),
      metricSignal(entityKey(context.targetEntity), 'institution_research_growth', growth, 'PREDICTION'),
    ],
    now,
    metadata: {
      contributingProviders,
      linkedRiskFindings: linkedRiskFindings.length,
    },
  })];
}

function specialtyDecisions(context: DecisionContext, now: string): DecisionResult[] {
  const shortagePredictions = context.predictions.filter((prediction) =>
    prediction.predictionType === 'WORKFORCE_SHORTAGE_ESCALATION' && prediction.probability >= 0.55,
  );
  if (shortagePredictions.length === 0) {
    return [];
  }

  const leadingPrediction = shortagePredictions[0]!;
  const specialtyLabel = context.targetEntity.entityLabel ?? context.targetEntity.entityId;
  const pressureScore = predictionMetric(leadingPrediction, 'pressure_score') ?? asNumber(leadingPrediction.metadata.pressureScore) ?? 0;
  const shortageRatio = predictionMetric(leadingPrediction, 'shortage_ratio');
  const demand = predictionMetric(leadingPrediction, 'active_demand') ?? asNumber(leadingPrediction.metadata.demand);
  const supply = predictionMetric(leadingPrediction, 'mapped_supply') ?? asNumber(leadingPrediction.metadata.supply);

  return [buildDecision({
    type: 'SPECIALTY_PRESSURE_TRACKING',
    targetEntity: context.targetEntity,
    recommendation: 'TRACK_SPECIALTY',
    explanation: `${specialtyLabel} should be tracked because demand exceeds mapped supply${pressureScore > 0 ? ` and the pressure score reached ${pressureScore}` : ''}.`,
    findings: context.findings,
    storylines: context.storylines,
    predictions: shortagePredictions,
    supportingSignals: [
      predictionSignal(leadingPrediction, leadingPrediction.predictionType),
      ...[
        predictionEvidenceSignal(leadingPrediction, 'active_demand'),
        predictionEvidenceSignal(leadingPrediction, 'mapped_supply'),
        predictionEvidenceSignal(leadingPrediction, 'shortage_ratio'),
        predictionEvidenceSignal(leadingPrediction, 'pressure_score'),
      ].filter((signal): signal is DecisionSupportingSignal => signal !== null),
      metricSignal(entityKey(context.targetEntity), 'active_demand', demand ?? null, 'OPPORTUNITIES'),
      metricSignal(entityKey(context.targetEntity), 'mapped_supply', supply ?? null, 'PERSON_PROFILES'),
      metricSignal(entityKey(context.targetEntity), 'shortage_ratio', shortageRatio ?? null, 'OPPORTUNITIES'),
    ],
    now,
    metadata: {
      pressureScore,
    },
  })];
}

function buildContexts(input: DecisionEngineInput): DecisionContext[] {
  const contexts = new Map<string, DecisionContext>();
  const linkedFindingsByEntity = new Map<string, DecisionFinding[]>();

  for (const finding of input.findings) {
    for (const entity of finding.entities) {
      const key = entityKey(entity);
      const list = linkedFindingsByEntity.get(key) ?? [];
      list.push(finding);
      linkedFindingsByEntity.set(key, list);
    }
  }

  const ensureContext = (targetEntity: DecisionTargetEntity): DecisionContext => {
    const key = entityKey(targetEntity);
    const existing = contexts.get(key);
    if (existing) {
      return existing;
    }

    const created: DecisionContext = {
      targetEntity,
      findings: [],
      storylines: [],
      predictions: [],
      linkedFindings: linkedFindingsByEntity.get(key) ?? [],
    };
    contexts.set(key, created);
    return created;
  };

  for (const finding of input.findings) {
    ensureContext(finding.primaryEntity).findings.push(finding);
  }

  for (const storyline of input.storylines) {
    ensureContext(storyline.targetEntity).storylines.push(storyline);
  }

  for (const prediction of input.predictions) {
    ensureContext(prediction.targetEntity).predictions.push(prediction);
  }

  return [...contexts.values()];
}

export function createDecisionEngine() {
  return {
    generate(input: DecisionEngineInput): DecisionResult[] {
      const now = input.now ?? new Date().toISOString();
      const contexts = buildContexts(input);
      const decisions: DecisionResult[] = [];

      for (const context of contexts) {
        switch (context.targetEntity.entityType) {
          case 'provider':
          case 'graph_node':
            decisions.push(...providerDecisions(context, now));
            break;
          case 'institution':
            decisions.push(...institutionDecisions(context, now));
            break;
          case 'market':
          case 'specialty':
            decisions.push(...specialtyDecisions(context, now));
            break;
          default:
            break;
        }
      }

      return decisions
        .sort((left, right) => {
          if (right.priorityScore !== left.priorityScore) {
            return right.priorityScore - left.priorityScore;
          }
          if (right.confidence !== left.confidence) {
            return right.confidence - left.confidence;
          }
          return left.id.localeCompare(right.id);
        });
    },
  };
}
