import { createHash } from 'node:crypto';
import {
  computePriorityScore,
  scoreToPriority,
  summarizeDecisionBundle,
  type DecisionBundleSummary,
} from './scoring';
import type {
  DecisionActionType,
  DecisionEngineInput,
  DecisionExplainability,
  DecisionGraphContext,
  DecisionInputSignal,
  DecisionRecommendation,
  DecisionSignalReference,
  DecisionTargetEntity,
} from './types';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function targetKey(target: DecisionTargetEntity): string {
  return `${target.entityType}:${target.entityId}`;
}

function actionTitle(actionType: DecisionActionType, target: DecisionTargetEntity): string {
  const label = target.entityLabel ?? target.entityId;
  switch (actionType) {
    case 'REVIEW_NOW':
      return `Review ${label} now`;
    case 'MONITOR':
      return `Monitor ${label}`;
    case 'ESCALATE':
      return `Escalate ${label}`;
    case 'COMPARE_WITH_PEERS':
      return `Compare ${label} with peers`;
    case 'VERIFY_SOURCE':
      return `Verify the source for ${label}`;
    case 'REQUEST_MORE_EVIDENCE':
      return `Request more evidence for ${label}`;
    case 'PRIORITIZE_OUTREACH':
      return `Prioritize outreach for ${label}`;
    case 'DEFER_ACTION':
      return `Defer action on ${label}`;
    case 'SAVE_TO_WATCHLIST':
      return `Save ${label} to the watchlist`;
  }
}

function recommendedTiming(actionType: DecisionActionType): string {
  switch (actionType) {
    case 'REVIEW_NOW':
      return 'within 24 hours';
    case 'ESCALATE':
      return 'today';
    case 'VERIFY_SOURCE':
    case 'REQUEST_MORE_EVIDENCE':
      return 'before escalation';
    case 'PRIORITIZE_OUTREACH':
      return 'within 72 hours';
    case 'DEFER_ACTION':
      return 'revisit in 7 days';
    case 'SAVE_TO_WATCHLIST':
      return 'track weekly';
    case 'COMPARE_WITH_PEERS':
      return 'this week';
    case 'MONITOR':
    default:
      return 'next refresh cycle';
  }
}

function signalReferences(signals: DecisionInputSignal[], graphSignals: DecisionGraphContext[]): DecisionSignalReference[] {
  const signalRefs = signals.map((signal) => ({
    signalId: signal.signalId,
    kind: signal.kind,
    signalType: signal.signalType,
    label: signal.label,
    value: signal.value ?? null,
    confidence: signal.confidence,
    observedAt: signal.observedAt,
    severity: signal.severity,
    direction: signal.direction,
    corroboration: signal.corroboration,
    sources: signal.sources,
    sourceIds: signal.sourceIds,
    metadata: signal.metadata,
  }));
  const graphRefs = graphSignals.map((signal) => ({
    signalId: `${signal.targetEntity.entityType}:${signal.targetEntity.entityId}:graph`,
    kind: 'graph' as const,
    signalType: 'GRAPH_CONTEXT',
    label: `graph centrality ${Math.round(signal.centrality * 100)}%`,
    value: signal.centrality,
    confidence: clamp01(signal.corroboration ?? 0.5),
    observedAt: signal.observedAt,
    corroboration: signal.corroboration,
    metadata: {
      centrality: signal.centrality,
      clusterCount: signal.clusterCount,
      recentConnectionDelta: signal.recentConnectionDelta,
      ...(signal.metadata ?? {}),
    },
  }));

  return [...signalRefs, ...graphRefs].slice(0, 6);
}

function observedFacts(summary: DecisionBundleSummary): string[] {
  return [
    ...summary.findingSignals.slice(0, 3).map((signal) => signal.label),
    ...summary.storylineSignals.slice(0, 2).map((signal) => signal.label),
  ].slice(0, 4);
}

function predictionFacts(summary: DecisionBundleSummary): string[] {
  return summary.predictionSignals
    .slice(0, 3)
    .map((signal) => signal.label);
}

function primaryFinding(summary: DecisionBundleSummary): string | null {
  return summary.findingSignals[0]?.label
    ?? summary.storylineSignals[0]?.label
    ?? summary.predictionSignals[0]?.label
    ?? null;
}

function explainability(
  summary: DecisionBundleSummary,
  actionType: DecisionActionType,
  why: string,
): DecisionExplainability {
  const watchNext = actionType === 'REVIEW_NOW'
    ? 'Watch for additional corroboration, source freshness changes, or a trust-state downgrade.'
    : actionType === 'ESCALATE'
      ? 'Watch for more corroborating findings, new institutional links, or operator feedback.'
      : actionType === 'PRIORITIZE_OUTREACH'
        ? 'Watch for sustained trajectory growth, specialty pressure persistence, and peer movement.'
        : actionType === 'VERIFY_SOURCE'
          ? 'Watch for a second authoritative source or resolution of the current source conflict.'
          : actionType === 'REQUEST_MORE_EVIDENCE'
            ? 'Watch for new evidence bundles, authoritative cross-checks, or confidence improvement.'
            : actionType === 'DEFER_ACTION'
              ? 'Watch for prediction confidence to cross threshold or observed findings to appear.'
              : actionType === 'COMPARE_WITH_PEERS'
                ? 'Watch for peer divergence, centrality growth, and corroborating trend persistence.'
                : actionType === 'SAVE_TO_WATCHLIST'
                  ? 'Watch for stronger corroboration or urgency changes before escalating.'
                  : 'Watch for corroboration growth, recency changes, and centrality movement.';

  const urgency = actionType === 'REVIEW_NOW' || actionType === 'ESCALATE'
    ? 'high'
    : actionType === 'PRIORITIZE_OUTREACH' || actionType === 'VERIFY_SOURCE'
      ? 'medium'
      : 'low';

  return {
    why,
    urgency,
    watchNext,
    heuristic: summary.heuristicOnly,
    observedFacts: observedFacts(summary),
    predictions: predictionFacts(summary),
  };
}

function rationaleFor(
  summary: DecisionBundleSummary,
  actionType: DecisionActionType,
  target: DecisionTargetEntity,
): string {
  const label = target.entityLabel ?? target.entityId;
  const keyFact = primaryFinding(summary) ?? `the latest signal set for ${label}`;
  const corroborationCount = Math.max(
    ...[
      ...summary.findingSignals.map((signal) => signal.corroboration ?? 0),
      ...summary.storylineSignals.map((signal) => signal.corroboration ?? 0),
      ...summary.predictionSignals.map((signal) => signal.corroboration ?? 0),
    ],
    0,
  );

  switch (actionType) {
    case 'REVIEW_NOW':
      return `Review now because ${keyFact.toLowerCase()} is critical, highly confident, and corroborated by ${Math.max(corroborationCount, 2)} supporting signal(s).`;
    case 'ESCALATE':
      return `Escalate because ${keyFact.toLowerCase()} has moved beyond an early signal and now carries enough corroboration for investigation.`;
    case 'PRIORITIZE_OUTREACH':
      return `Prioritize outreach because ${label} is on a rising trajectory while specialty pressure indicates near-term demand.`;
    case 'COMPARE_WITH_PEERS':
      return `Compare with peers because ${label} has a meaningful trajectory or centrality shift that needs cohort context before acting.`;
    case 'VERIFY_SOURCE':
      return `Verify source because ${keyFact.toLowerCase()} is material but currently rests on sparse or uneven corroboration.`;
    case 'REQUEST_MORE_EVIDENCE':
      return `Request more evidence because the current signal is too thin to recommend escalation with confidence.`;
    case 'DEFER_ACTION':
      return `Defer action because the recommendation is still heuristic and prediction confidence remains below threshold.`;
    case 'SAVE_TO_WATCHLIST':
      return `Save to the watchlist because ${keyFact.toLowerCase()} is worth tracking, but current urgency is limited.`;
    case 'MONITOR':
    default:
      return `Monitor because ${keyFact.toLowerCase()} is emerging, but corroboration is not yet strong enough for escalation.`;
  }
}

function recommendationConfidence(summary: DecisionBundleSummary, actionType: DecisionActionType): number {
  const base = summary.confidence * 0.72
    + summary.corroboration * 0.18
    + summary.historicalTruthRate * 0.1;
  if (actionType === 'REQUEST_MORE_EVIDENCE' || actionType === 'DEFER_ACTION') {
    return clamp01(Math.min(base, 0.62));
  }
  return clamp01(base);
}

function createRecommendation(
  summary: DecisionBundleSummary,
  actionType: DecisionActionType,
  target: DecisionTargetEntity,
  signals: DecisionInputSignal[],
  graphSignals: DecisionGraphContext[],
  nowIso: string,
): DecisionRecommendation {
  const title = actionTitle(actionType, target);
  const rationale = rationaleFor(summary, actionType, target);
  const scoreBreakdown = computePriorityScore(summary, actionType);
  const confidence = recommendationConfidence(summary, actionType);
  const explain = explainability(summary, actionType, rationale);

  return {
    decisionId: `decision_${stableHash(`${actionType}:${targetKey(target)}:${signals.map((signal) => signal.signalId).sort().join(',')}`)}`,
    actionType,
    targetEntity: target,
    priority: scoreToPriority(scoreBreakdown.total),
    priorityScore: scoreBreakdown.total,
    confidence,
    title,
    rationale,
    supportingSignals: signalReferences(signals, graphSignals),
    recommendedTiming: recommendedTiming(actionType),
    state: 'new',
    explainability: explain,
    scoreBreakdown,
    createdAt: nowIso,
    updatedAt: nowIso,
    actedOnAt: null,
    feedbackNote: null,
    metadata: {
      heuristic: explain.heuristic,
      targetKey: targetKey(target),
    },
  };
}

function ruleTriggered(actionType: DecisionActionType, summary: DecisionBundleSummary): boolean {
  switch (actionType) {
    case 'REVIEW_NOW':
      return summary.hasCriticalObservedSignal
        && summary.hasHighConfidenceSignal
        && !summary.lowCorroboration;
    case 'ESCALATE':
      return summary.hasDevelopingStoryline
        && !summary.lowCorroboration
        && summary.confidence >= 0.62;
    case 'PRIORITIZE_OUTREACH':
      return summary.hasRisingTrajectory
        && summary.hasSpecialtyPressure
        && summary.confidence >= 0.58;
    case 'VERIFY_SOURCE':
      return summary.severity >= 0.8 && (summary.lowCorroboration || summary.sourceSparse);
    case 'REQUEST_MORE_EVIDENCE':
      return summary.confidence >= 0.2 && (summary.confidence < 0.42 || summary.lowCorroboration);
    case 'DEFER_ACTION':
      return summary.hasLowConfidencePrediction || (summary.heuristicOnly && summary.confidence < 0.5);
    case 'MONITOR':
      return summary.hasNetworkShift && summary.lowCorroboration;
    case 'COMPARE_WITH_PEERS':
      return summary.hasRisingTrajectory && summary.centrality >= 0.35;
    case 'SAVE_TO_WATCHLIST':
      return summary.novelty >= 0.45 && summary.recency >= 0.44 && summary.confidence >= 0.42;
  }
}

function dedupeRecommendations(recommendations: DecisionRecommendation[]): DecisionRecommendation[] {
  const deduped = new Map<string, DecisionRecommendation>();

  for (const recommendation of recommendations) {
    const key = `${recommendation.actionType}:${recommendation.targetEntity.entityType}:${recommendation.targetEntity.entityId}`;
    const current = deduped.get(key);
    if (!current || recommendation.priorityScore > current.priorityScore) {
      deduped.set(key, recommendation);
    }
  }

  return [...deduped.values()];
}

export function generateDecisionRecommendations(input: DecisionEngineInput): DecisionRecommendation[] {
  const nowIso = input.now ?? new Date().toISOString();
  const bundles = new Map<string, { target: DecisionTargetEntity; signals: DecisionInputSignal[]; graphSignals: DecisionGraphContext[] }>();

  for (const signal of [...input.findings, ...input.storylines, ...input.predictions]) {
    const key = targetKey(signal.targetEntity);
    const bundle = bundles.get(key) ?? { target: signal.targetEntity, signals: [], graphSignals: [] };
    bundle.signals.push(signal);
    bundles.set(key, bundle);
  }

  for (const graphSignal of input.graphContext) {
    const key = targetKey(graphSignal.targetEntity);
    const bundle = bundles.get(key);
    if (bundle) {
      bundle.graphSignals.push(graphSignal);
    }
  }

  const recommendations: DecisionRecommendation[] = [];

  for (const [key, bundle] of bundles) {
    const summary = summarizeDecisionBundle({
      targetKey: key,
      signals: bundle.signals,
      graphSignals: bundle.graphSignals,
      nowIso,
    });

    if (summary.confidence < 0.2) {
      continue;
    }

    const orderedActions: DecisionActionType[] = [
      'REVIEW_NOW',
      'ESCALATE',
      'VERIFY_SOURCE',
      'REQUEST_MORE_EVIDENCE',
      'DEFER_ACTION',
      'PRIORITIZE_OUTREACH',
      'COMPARE_WITH_PEERS',
      'MONITOR',
      'SAVE_TO_WATCHLIST',
    ];

    for (const actionType of orderedActions) {
      if (!ruleTriggered(actionType, summary)) {
        continue;
      }

      if ((actionType === 'REVIEW_NOW' || actionType === 'ESCALATE') && (summary.lowCorroboration || summary.confidence < 0.5)) {
        continue;
      }

      if (actionType === 'PRIORITIZE_OUTREACH' && summary.targetKey.startsWith('specialty:')) {
        continue;
      }

      recommendations.push(createRecommendation(
        summary,
        actionType,
        bundle.target,
        bundle.signals,
        bundle.graphSignals,
        nowIso,
      ));
    }
  }

  return dedupeRecommendations(recommendations)
    .sort((left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence);
}
