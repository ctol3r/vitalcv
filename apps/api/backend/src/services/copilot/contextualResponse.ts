import type {
  CopilotContext,
  CopilotContextAnchor,
  CopilotContextFinding,
  CopilotContextStoryline,
} from '../../../../../../core/copilot/contextBuilder';
import { collectCopilotContextSources } from '../../../../../../core/copilot/contextBuilder';
import type {
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotQueryResponse,
  CopilotResult,
  CopilotResultScores,
  PreparedCopilotQuery,
} from '../../../../../../core/copilot/copilotEngine';

export const COPILOT_WARMING_MESSAGE = 'System warming — data loading';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

function recencyScore(timestamp: string | null | undefined): number {
  if (!timestamp) {
    return 0.35;
  }

  const ageDays = Math.max(0, (Date.now() - Date.parse(timestamp)) / 86_400_000);
  if (ageDays <= 7) {
    return 1;
  }
  if (ageDays <= 21) {
    return 0.82;
  }
  if (ageDays <= 60) {
    return 0.58;
  }
  return 0.32;
}

function severityScore(severity: string): number {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 1;
    case 'high':
      return 0.84;
    case 'medium':
      return 0.63;
    case 'low':
      return 0.38;
    default:
      return 0.24;
  }
}

function sourceCoverageScore(sources: readonly string[]): number {
  return clamp01(sources.length / 5);
}

function providerScores(context: CopilotContext): CopilotResultScores {
  const provider = context.provider!;
  const freshness = recencyScore(context.recentFindings[0]?.createdAt ?? null);
  const trust = clamp01(provider.trustScore / 100);
  const sourceCoverage = sourceCoverageScore(provider.sources);
  const relevance = clamp01(
    0.45
    + (trust * 0.2)
    + (clamp01(context.recentFindings.length / 5) * 0.15)
    + (clamp01(context.activeStorylines.length / 5) * 0.2),
  );

  return {
    relevance,
    trustScore: trust,
    freshness,
    sourceCoverage,
    total: clamp01((relevance * 0.4) + (trust * 0.25) + (freshness * 0.15) + (sourceCoverage * 0.2)),
  };
}

function findingScores(finding: CopilotContextFinding): CopilotResultScores {
  const relevance = clamp01((severityScore(finding.severity) * 0.55) + (clamp01(finding.confidence) * 0.45));
  const freshness = recencyScore(finding.createdAt);
  const sourceCoverage = sourceCoverageScore(finding.sources);
  return {
    relevance,
    trustScore: clamp01(finding.confidence),
    freshness,
    sourceCoverage,
    total: clamp01((relevance * 0.45) + (clamp01(finding.confidence) * 0.3) + (freshness * 0.1) + (sourceCoverage * 0.15)),
  };
}

function storylineScores(storyline: CopilotContextStoryline): CopilotResultScores {
  const relevance = clamp01((severityScore(storyline.severity) * 0.45) + (clamp01(storyline.confidence) * 0.55));
  const freshness = recencyScore(storyline.lastActivityAt);
  const sourceCoverage = sourceCoverageScore(storyline.sources);
  return {
    relevance,
    trustScore: clamp01(storyline.confidence),
    freshness,
    sourceCoverage,
    total: clamp01((relevance * 0.45) + (clamp01(storyline.confidence) * 0.3) + (freshness * 0.1) + (sourceCoverage * 0.15)),
  };
}

function buildFindingResult(
  finding: CopilotContextFinding,
  rank: number,
): CopilotResult {
  return {
    id: `finding:${finding.id}`,
    rank,
    type: 'DOCUMENT',
    title: finding.title,
    subtitle: `${finding.findingType} · ${finding.severity} · ${finding.status}`,
    summary: finding.summary,
    scores: findingScores(finding),
    sourceCoverage: finding.sources,
  };
}

function buildStorylineResult(
  storyline: CopilotContextStoryline,
  rank: number,
): CopilotResult {
  return {
    id: `storyline:${storyline.id}`,
    rank,
    type: 'DOCUMENT',
    title: storyline.title,
    subtitle: `${storyline.storylineType} · ${storyline.severity} · ${storyline.status}`,
    summary: storyline.summary,
    scores: storylineScores(storyline),
    sourceCoverage: storyline.sources,
  };
}

function buildProviderResult(
  context: CopilotContext,
  rank: number,
): CopilotResult {
  const provider = context.provider!;
  return {
    id: `clinician:${provider.providerId}`,
    rank,
    type: 'CLINICIAN',
    title: provider.label ?? `Provider ${provider.providerId}`,
    subtitle: [provider.specialty, provider.state].filter(Boolean).join(' · ') || provider.providerId,
    summary: `${provider.label ?? provider.providerId} is at trust ${Math.round(provider.trustScore)}/100 (${provider.trustBand}) with ${context.recentFindings.length} recent finding(s) and ${context.activeStorylines.length} active storyline(s).`,
    specialty: provider.specialty ?? undefined,
    state: provider.state ?? undefined,
    trustScore: provider.trustScore,
    trustBand: provider.trustBand,
    scores: providerScores(context),
    sourceCoverage: provider.sources,
  };
}

function buildFindingExplanation(resultId: string, finding: CopilotContextFinding): CopilotExplanation {
  const scoring = findingScores(finding);
  return {
    resultId,
    title: finding.title,
    summary: finding.explanation || finding.summary,
    because: uniqueStrings([
      finding.explanation,
      `${finding.findingType} finding is ${finding.severity} and ${finding.status}.`,
      `Confidence ${(finding.confidence * 100).toFixed(0)}%.`,
    ]).slice(0, 5),
    matchedFilters: [],
    verifiedSources: finding.sources,
    scoring,
  };
}

function buildStorylineExplanation(resultId: string, storyline: CopilotContextStoryline): CopilotExplanation {
  const scoring = storylineScores(storyline);
  return {
    resultId,
    title: storyline.title,
    summary: storyline.whyItMatters,
    because: uniqueStrings([
      storyline.whyItMatters,
      storyline.lifecycleStage ? `Lifecycle stage: ${storyline.lifecycleStage}.` : '',
      storyline.recommendedActions[0] ? `Recommended action: ${storyline.recommendedActions[0]}.` : '',
      `Confidence ${(storyline.confidence * 100).toFixed(0)}%.`,
    ]).slice(0, 5),
    matchedFilters: [],
    verifiedSources: storyline.sources,
    scoring,
  };
}

function buildProviderExplanation(resultId: string, context: CopilotContext): CopilotExplanation {
  const provider = context.provider!;
  const scoring = providerScores(context);
  const topRisk = context.riskSignals[0];
  return {
    resultId,
    title: provider.label ?? provider.providerId,
    summary: `${provider.label ?? provider.providerId} is grounded on the current provider trust profile, recent findings, and active storyline activity.`,
    because: uniqueStrings([
      `Trust ${Math.round(provider.trustScore)}/100 (${provider.trustBand}).`,
      `${provider.activeFindings} active finding(s).`,
      `${context.activeStorylines.length} active storyline(s).`,
      topRisk ? `${topRisk.label}: ${topRisk.explanation}` : '',
    ]).slice(0, 5),
    matchedFilters: [],
    verifiedSources: provider.sources,
    scoring,
  };
}

function buildGraphInsights(context: CopilotContext): CopilotGraphInsight[] {
  const insights: CopilotGraphInsight[] = [];

  if (context.networkSummary) {
    for (const summary of context.networkSummary.topPathSummaries.slice(0, 3)) {
      insights.push({
        resultId: context.provider ? `clinician:${context.provider.providerId}` : undefined,
        type: 'COLLABORATOR',
        summary,
        path: [
          context.networkSummary.focusNodeId ?? 'network',
          ...context.networkSummary.highlightNodeIds.slice(0, 2),
        ],
        depth: 1,
      });
    }
  }

  if (insights.length === 0 && context.provider?.networkHighlights.length) {
    for (const highlight of context.provider.networkHighlights.slice(0, 3)) {
      insights.push({
        resultId: `clinician:${context.provider.providerId}`,
        type: 'SOURCE_COVERAGE',
        summary: highlight,
        path: [context.provider.label ?? context.provider.providerId],
        depth: 1,
      });
    }
  }

  return insights;
}

function contextualAnswer(
  preparedQuery: PreparedCopilotQuery,
  context: CopilotContext,
  anchor: CopilotContextAnchor,
): string {
  const selectedFinding = anchor.findingId
    ? context.recentFindings.find((finding) => finding.id === anchor.findingId) ?? null
    : null;
  if (selectedFinding) {
    const supporting = context.riskSignals
      .filter((signal) => signal.id !== `finding:${selectedFinding.id}`)
      .slice(0, 2)
      .map((signal) => signal.label.toLowerCase())
      .join('; ');
    return supporting
      ? `${selectedFinding.title} is flagged because ${selectedFinding.explanation}. Contributing signals: ${supporting}.`
      : `${selectedFinding.title} is flagged because ${selectedFinding.explanation}.`;
  }

  const selectedStoryline = anchor.storylineId
    ? context.activeStorylines.find((storyline) => storyline.id === anchor.storylineId) ?? null
    : null;
  if (selectedStoryline) {
    return `${selectedStoryline.title} matters because ${selectedStoryline.whyItMatters}.`;
  }

  if (context.provider) {
    const topRisk = context.riskSignals[0];
    const providerName = context.provider.label ?? context.provider.providerId;
    if (preparedQuery.parsedQuery.intent === 'EXPLAINABILITY' && topRisk) {
      return `${providerName} is currently constrained by ${topRisk.label.toLowerCase()}: ${topRisk.explanation}`;
    }
    return `${providerName} is at trust ${Math.round(context.provider.trustScore)}/100 (${context.provider.trustBand}) with ${context.recentFindings.length} recent finding(s) and ${context.activeStorylines.length} active storyline(s).`;
  }

  return COPILOT_WARMING_MESSAGE;
}

export function finalizeCopilotResponse(
  response: CopilotQueryResponse,
  fallbackAnswer = COPILOT_WARMING_MESSAGE,
): CopilotQueryResponse {
  const answer = response.answer?.trim()
    || response.explanations[0]?.summary
    || response.results[0]?.summary
    || response.graphInsights[0]?.summary
    || fallbackAnswer;
  const sources = uniqueStrings([
    ...(response.sources ?? []),
    ...response.results.flatMap((result) => result.sourceCoverage),
    ...response.explanations.flatMap((explanation) => explanation.verifiedSources),
  ]);
  const confidenceCandidates = [
    response.confidence,
    response.results[0]?.scores.total,
    response.explanations[0]?.scoring.total,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    ...response,
    answer,
    sources,
    confidence: clamp01(confidenceCandidates[0] ?? 0),
  };
}

export function buildWarmCopilotResponse(
  preparedQuery: PreparedCopilotQuery,
): CopilotQueryResponse {
  return {
    parsedQuery: preparedQuery.parsedQuery,
    results: [],
    explanations: [],
    graphInsights: [],
    answer: COPILOT_WARMING_MESSAGE,
    sources: [],
    confidence: 0,
  };
}

export function buildContextualCopilotResponse(
  preparedQuery: PreparedCopilotQuery,
  context: CopilotContext,
  anchor: CopilotContextAnchor,
): CopilotQueryResponse {
  const orderedResults: CopilotResult[] = [];
  const explanations: CopilotExplanation[] = [];

  const selectedFinding = anchor.findingId
    ? context.recentFindings.find((finding) => finding.id === anchor.findingId) ?? null
    : null;
  const selectedStoryline = anchor.storylineId
    ? context.activeStorylines.find((storyline) => storyline.id === anchor.storylineId) ?? null
    : null;

  if (selectedFinding) {
    const result = buildFindingResult(selectedFinding, orderedResults.length + 1);
    orderedResults.push(result);
    explanations.push(buildFindingExplanation(result.id, selectedFinding));
  }

  if (selectedStoryline) {
    const result = buildStorylineResult(selectedStoryline, orderedResults.length + 1);
    orderedResults.push(result);
    explanations.push(buildStorylineExplanation(result.id, selectedStoryline));
  }

  if (context.provider) {
    const result = buildProviderResult(context, orderedResults.length + 1);
    orderedResults.push(result);
    explanations.push(buildProviderExplanation(result.id, context));
  }

  for (const finding of context.recentFindings) {
    if (selectedFinding?.id === finding.id) {
      continue;
    }
    if (orderedResults.length >= preparedQuery.plan.limit) {
      break;
    }
    const result = buildFindingResult(finding, orderedResults.length + 1);
    orderedResults.push(result);
    explanations.push(buildFindingExplanation(result.id, finding));
  }

  for (const storyline of context.activeStorylines) {
    if (selectedStoryline?.id === storyline.id) {
      continue;
    }
    if (orderedResults.length >= preparedQuery.plan.limit) {
      break;
    }
    const result = buildStorylineResult(storyline, orderedResults.length + 1);
    orderedResults.push(result);
    explanations.push(buildStorylineExplanation(result.id, storyline));
  }

  const trimmedResults = orderedResults.slice(0, preparedQuery.plan.limit);
  const resultIds = new Set(trimmedResults.map((result) => result.id));
  const reRankedResults = trimmedResults.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
  const filteredExplanations = explanations.filter((explanation) => resultIds.has(explanation.resultId));
  const graphInsights = buildGraphInsights(context).map((insight) => (
    insight.resultId && !resultIds.has(insight.resultId)
      ? { ...insight, resultId: undefined }
      : insight
  ));
  const sources = collectCopilotContextSources(context);
  const confidence = clamp01(
    reRankedResults[0]?.scores.total
    ?? context.provider?.trustConfidence
    ?? context.recentFindings[0]?.confidence
    ?? context.activeStorylines[0]?.confidence
    ?? 0,
  );

  return finalizeCopilotResponse({
    parsedQuery: preparedQuery.parsedQuery,
    results: reRankedResults,
    explanations: filteredExplanations,
    graphInsights,
    answer: contextualAnswer(preparedQuery, context, anchor),
    sources,
    confidence,
  });
}
