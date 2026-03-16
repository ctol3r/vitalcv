import type { GraphNode, GraphQueryResult, NodeType } from '../graph-engine/schema';
import { queryGraph } from '../graph-engine/queryService';
import { log } from '../../obs/logger';
import { querySearch, type SearchResponse, type SearchResult } from '../search/searchIndex';
import type { SearchRequestContext } from '../search/requestContext';
import { SOURCE_CATALOG } from '../identity/sourceCatalog';
import { maybeExecuteIntelligenceContextQuery } from './intelligenceContextAdapter';
import { maybeExecutePredictionCopilotQuery } from './predictionQueryService';
import { maybeExecuteStorylineCopilotQuery } from './storylineCopilotAdapter';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import { withToolSpan } from '../../tools/tracing';
import {
  listDecisionRecommendations,
  summarizeDecisionForCopilot,
  type StoredDecisionRecommendation,
} from '../decisions/decisionRecommendationService';
import {
  searchStrategyInsightsForCopilot,
  strategyInsightAffiliations,
  strategyInsightGraphSignals,
  strategyInsightInstitution,
  strategyInsightResearchTopics,
  strategyInsightSourceCoverage,
  strategyInsightSpecialty,
  strategyInsightState,
} from '../strategy/strategyEngineService';
import { searchStrategyAgentArtifacts } from '../strategyAgents/strategyAgentService';
import {
  executeCopilotPlan,
  prepareCopilotQuery,
  type CopilotCandidate,
  type CopilotDependencies,
  type CopilotEntityType,
  type CopilotEvidence,
  type CopilotGraphInsight,
  type CopilotMatch,
  type CopilotQueryResponse,
  type CopilotSearchContext,
  type CopilotTrustEnrichment,
  type ParsedCopilotQuery,
} from '../../../../../../core/copilot/copilotEngine';
import type { StrategyInsight } from '../../../../../../core/strategy/strategyEngine';
import type {
  StrategyInsight as StrategyAgentInsight,
  StrategyReport as StrategyAgentReport,
} from '../strategyAgents/contracts';

type ExtractedCandidateFields = {
  specialty?: string;
  state?: string;
  institution?: string;
  licenseStatus?: string;
  boardCertified?: boolean;
  trustScore?: number;
  researchTopics: string[];
  affiliations: string[];
  sourceCoverage: string[];
  npi?: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? normalizeText(value) : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => normalizeText(entry));
}

function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean | string[] | undefined> {
  const sanitized: Record<string, string | number | boolean | string[] | undefined> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      sanitized[key] = value as string[];
    }
  }

  return sanitized;
}

function sourceTypeFor(source: string): CopilotEvidence['sourceType'] {
  return SOURCE_CATALOG[source]?.tier ?? 'INTERNAL';
}

function decisionIntentRequested(query: string): boolean {
  return /\b(what should (?:we|i) do|what actions|recommended action|recommendation|require attention|needs attention|which providers|what institutions|should we monitor|monitor|escalat|verify|investigat)\b/i.test(query);
}

function providerIdFromResultId(resultId: string): string | null {
  const match = resultId.match(/^clinician:(\d{10})$/);
  return match?.[1] ?? null;
}

function decisionSources(recommendation: StoredDecisionRecommendation): string[] {
  return dedupeStrings(
    recommendation.supportingSignals.flatMap((signal) => signal.sources ?? []),
  );
}

function decisionScores(recommendation: StoredDecisionRecommendation) {
  const sourceCoverage = decisionSources(recommendation);
  const total = clamp01(recommendation.priorityScore);
  return {
    relevance: clamp01(0.58 + (recommendation.confidence * 0.3)),
    trustScore: clamp01(recommendation.confidence),
    freshness: recommendation.sourceFindingIds.length === 0 ? 0.42 : 0.81,
    sourceCoverage: clamp01(sourceCoverage.length / 4),
    total,
  };
}

function synthesizeDecisionResult(
  recommendation: StoredDecisionRecommendation,
  rank: number,
): CopilotQueryResponse['results'][number] {
  const scores = decisionScores(recommendation);
  const title = recommendation.targetEntity.entityLabel ?? recommendation.targetEntity.entityId;
  const type: CopilotEntityType = recommendation.targetEntity.entityType === 'provider'
    ? 'CLINICIAN'
    : recommendation.targetEntity.entityType === 'institution'
      ? 'ORGANIZATION'
      : ['market', 'specialty'].includes(recommendation.targetEntity.entityType)
        ? 'PROGRAM'
        : 'DOCUMENT';

  return {
    id: `decision:${recommendation.decisionId}`,
    rank,
    type,
    title,
    subtitle: `${recommendation.actionType} · ${recommendation.priority.toUpperCase()}`,
    summary: recommendation.rationale,
    scores,
    sourceCoverage: decisionSources(recommendation),
  };
}

function synthesizeDecisionExplanation(
  recommendation: StoredDecisionRecommendation,
  resultId: string,
): CopilotQueryResponse['explanations'][number] {
  const scores = decisionScores(recommendation);
  const because = dedupeStrings([
    `action = ${recommendation.actionType}`,
    `priority = ${recommendation.priority}`,
    ...recommendation.supportingSignals
      .slice(0, 3)
      .map((signal) => `${signal.label}${signal.value !== undefined && signal.value !== null ? ` = ${signal.value}` : ''}`),
  ]).slice(0, 5);

  return {
    resultId,
    title: recommendation.targetEntity.entityLabel ?? recommendation.targetEntity.entityId,
    summary: summarizeDecisionForCopilot(recommendation),
    because,
    matchedFilters: [],
    verifiedSources: decisionSources(recommendation),
    scoring: scores,
  };
}

async function augmentWithDecisionSupport(
  response: CopilotQueryResponse,
  rawQuery: string,
): Promise<CopilotQueryResponse> {
  if (!decisionIntentRequested(rawQuery)) {
    return response;
  }

  const nextResults = [...response.results];
  const nextExplanations = [...response.explanations];

  const providerResults = nextResults
    .map((result) => ({
      result,
      providerId: providerIdFromResultId(result.id),
    }))
    .filter((entry): entry is { result: CopilotQueryResponse['results'][number]; providerId: string } => Boolean(entry.providerId))
    .slice(0, 5);

  if (providerResults.length > 0) {
    const providerDecisionList = await listDecisionRecommendations({
      entityType: ['provider'],
      limit: 200,
    });
    const mapped = new Map<string, StoredDecisionRecommendation>();
    for (const recommendation of providerDecisionList.recommendations) {
      const providerId = recommendation.targetEntity.entityId;
      const existing = mapped.get(providerId);
      if (!existing || recommendation.priorityScore > existing.priorityScore) {
        mapped.set(providerId, recommendation);
      }
    }

    for (const entry of providerResults) {
      const decision = mapped.get(entry.providerId);
      if (!decision) {
        continue;
      }

      entry.result.summary = `${entry.result.summary} Top action: ${decision.actionType.toLowerCase()} (${decision.priority}).`;
      const explanation = nextExplanations.find((item) => item.resultId === entry.result.id);
      if (explanation) {
        explanation.summary = `${explanation.summary} ${summarizeDecisionForCopilot(decision)}`;
        explanation.because = dedupeStrings([
          ...explanation.because,
          `action = ${decision.actionType}`,
          `priority = ${decision.priority}`,
        ]).slice(0, 6);
        explanation.verifiedSources = dedupeStrings([
          ...explanation.verifiedSources,
          ...decisionSources(decision),
        ]).slice(0, 6);
      }
    }

    return {
      ...response,
      results: nextResults,
      explanations: nextExplanations,
    };
  }

  const lower = rawQuery.toLowerCase();
  const listResult = await listDecisionRecommendations({
    limit: 3,
    actionType: lower.includes('verify')
      ? ['VERIFY_SOURCE']
      : lower.includes('escalat')
        ? ['ESCALATE']
        : lower.includes('compare') || lower.includes('peer')
          ? ['COMPARE_WITH_PEERS']
          : lower.includes('monitor')
            ? ['MONITOR', 'SAVE_TO_WATCHLIST']
            : lower.includes('defer') || lower.includes('wait')
              ? ['DEFER_ACTION', 'REQUEST_MORE_EVIDENCE']
              : undefined,
    entityType: lower.includes('institution')
      ? ['institution']
      : lower.includes('specialty') || lower.includes('shortage')
        ? ['specialty']
        : ['provider'],
  });

  if (listResult.recommendations.length === 0) {
    return response;
  }

  const syntheticResults = listResult.recommendations.map((recommendation, index) =>
    synthesizeDecisionResult(recommendation, index + 1));
  const syntheticExplanations = syntheticResults.map((result, index) =>
    synthesizeDecisionExplanation(listResult.recommendations[index]!, result.id));

  return {
    ...response,
    results: [...syntheticResults, ...nextResults].slice(0, Math.max(response.results.length, syntheticResults.length)),
    explanations: [...syntheticExplanations, ...nextExplanations],
  };
}

function strategyIntentRequested(query: string): boolean {
  return /\b(influential|influence|trajectory|future leader|future leaders|recruit|recruiting|momentum|growing fastest|institution growth|cluster|clusters|research cluster|emerging network|shortage|shortages|talent movement|migration|provider opportunity|specialty shift|strategy|strategic)\b/i.test(query);
}

function strategyEntityTypeHint(query: string): string | undefined {
  const lower = query.toLowerCase();
  if (/\b(provider|providers|influential|thought leader|researcher|trajectory|future leader|future leaders)\b/.test(lower)) {
    return 'provider';
  }
  if (/\b(institution|institutions|hospital|system|growing fastest|momentum)\b/.test(lower)) {
    return 'institution';
  }
  if (/\b(specialty|shortage|shortages|recruit)\b/.test(lower)) {
    return 'specialty';
  }
  if (/\b(network|cluster|clusters|collaboration)\b/.test(lower)) {
    return 'network';
  }
  return undefined;
}

function strategySources(insight: StrategyInsight): string[] {
  return strategyInsightSourceCoverage(insight);
}

function strategyScores(insight: StrategyInsight) {
  const impactWeight = (() => {
    switch (insight.impactLevel) {
      case 'strategic':
        return 1;
      case 'major':
        return 0.82;
      case 'moderate':
        return 0.64;
      case 'minor':
      default:
        return 0.46;
    }
  })();

  const sourceCoverage = strategySources(insight);
  const total = clamp01((impactWeight * 0.55) + (insight.confidence * 0.45));
  return {
    relevance: clamp01((impactWeight * 0.52) + (insight.confidence * 0.3) + 0.18),
    trustScore: clamp01(insight.confidence),
    freshness: computeFreshnessScore(insight.updatedAt),
    sourceCoverage: clamp01(sourceCoverage.length / 4),
    total,
  };
}

function strategyResultType(insight: StrategyInsight): CopilotEntityType {
  if (insight.scope.entityType === 'provider') {
    return 'CLINICIAN';
  }
  if (insight.scope.entityType === 'institution') {
    return 'ORGANIZATION';
  }
  return 'DOCUMENT';
}

function synthesizeStrategyResult(
  insight: StrategyInsight,
  rank: number,
): CopilotQueryResponse['results'][number] {
  const specialty = strategyInsightSpecialty(insight);
  const state = strategyInsightState(insight);
  const institution = strategyInsightInstitution(insight);
  const scores = strategyScores(insight);

  return {
    id: `strategy:${insight.id}`,
    rank,
    type: strategyResultType(insight),
    title: insight.title,
    subtitle: `${insight.impactLevel.toUpperCase()} ${insight.type.replace(/_/g, ' ')}`,
    summary: insight.summary,
    specialty,
    state,
    institution,
    scores,
    sourceCoverage: strategySources(insight),
  };
}

function synthesizeStrategyExplanation(
  insight: StrategyInsight,
  resultId: string,
): CopilotQueryResponse['explanations'][number] {
  return {
    resultId,
    title: insight.title,
    summary: insight.explanation,
    because: dedupeStrings([
      ...insight.drivers.slice(0, 3).map((driver) => driver.explanation),
      ...insight.supportingPredictions.slice(0, 2).map((prediction) => prediction.explanation),
    ]).slice(0, 5),
    matchedFilters: [],
    verifiedSources: strategySources(insight),
    scoring: strategyScores(insight),
  };
}

function synthesizeStrategyGraphInsights(
  insight: StrategyInsight,
  resultId: string,
): CopilotQueryResponse['graphInsights'] {
  const graphSignals = strategyInsightGraphSignals(insight);
  if (graphSignals.length === 0) {
    return [];
  }

  return [{
    resultId,
    type: insight.scope.entityType === 'network' ? 'PUBLICATION_NETWORK' : 'SOURCE_COVERAGE',
    summary: graphSignals[0]!,
    path: [insight.title, ...graphSignals.slice(0, 2)],
    depth: 1,
  }];
}

function strategyAgentSources(match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight }): string[] {
  if (match.insight) {
    return dedupeStrings(match.insight.signals.map((signal) => signal.source));
  }

  if (match.report) {
    return dedupeStrings(match.report.signals.map((signal) => signal.source));
  }

  return [];
}

function strategyAgentScores(match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight }) {
  const confidence = match.insight?.confidence ?? match.report?.confidence ?? 0.35;
  const impactLevel = match.insight?.impactLevel ?? match.report?.impactLevel ?? 'LOW';
  const impactWeight = impactLevel === 'CRITICAL'
    ? 1
    : impactLevel === 'HIGH'
      ? 0.84
      : impactLevel === 'MEDIUM'
        ? 0.66
        : 0.48;
  const sources = strategyAgentSources(match);
  return {
    relevance: clamp01((impactWeight * 0.58) + (confidence * 0.3) + 0.12),
    trustScore: clamp01(confidence),
    freshness: computeFreshnessScore(match.insight?.generatedAt ?? match.report?.generatedAt),
    sourceCoverage: clamp01(Math.min(sources.length, 4) / 4),
    total: clamp01((impactWeight * 0.55) + (confidence * 0.45)),
  };
}

function strategyAgentResultType(match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight }): CopilotEntityType {
  const entityType = match.insight?.entities[0]?.entityType ?? match.report?.entities[0]?.entityType;
  if (entityType === 'provider') {
    return 'CLINICIAN';
  }
  if (entityType === 'institution') {
    return 'ORGANIZATION';
  }
  return 'DOCUMENT';
}

function synthesizeStrategyAgentResult(
  match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight },
  rank: number,
): CopilotQueryResponse['results'][number] {
  const insight = match.insight;
  const report = match.report;
  const title = insight?.headline ?? report?.headline ?? 'Strategy agent report';
  const summary = insight?.summary ?? report?.summary ?? 'Strategy agent output.';
  const subtitle = insight
    ? `${insight.agentType.replace(/_/g, ' ')} ${insight.impactLevel}`
    : `${report?.reportName ?? 'Agent report'} ${report?.impactLevel ?? 'LOW'}`;
  const specialty = insight?.entities[0]?.entityType === 'market'
    ? undefined
    : undefined;
  const state = insight?.entities[0]?.entityLabel?.slice(0, 2);

  return {
    id: `strategy-agent:${insight?.insightId ?? report?.reportId}`,
    rank,
    type: strategyAgentResultType(match),
    title,
    subtitle,
    summary,
    specialty,
    state,
    institution: report?.agentType === 'INSTITUTION_MOMENTUM'
      ? report.entities[0]?.entityLabel ?? undefined
      : insight?.entities[0]?.entityType === 'institution'
        ? insight.entities[0]?.entityLabel ?? undefined
        : undefined,
    scores: strategyAgentScores(match),
    sourceCoverage: strategyAgentSources(match),
  };
}

function synthesizeStrategyAgentExplanation(
  match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight },
  resultId: string,
): CopilotQueryResponse['explanations'][number] {
  const insight = match.insight;
  const report = match.report;
  return {
    resultId,
    title: insight?.headline ?? report?.headline ?? 'Strategy agent report',
    summary: insight?.summary ?? report?.summary ?? 'Strategy agent output.',
    because: dedupeStrings([
      ...(insight?.drivers ?? report?.drivers ?? []).slice(0, 3),
      ...(insight?.predictions ?? report?.predictions ?? []).slice(0, 2).map((prediction) => (
        `${prediction.predictionType.replace(/_/g, ' ').toLowerCase()} prediction ${Math.round(prediction.probability * 100)}% over ${prediction.timeHorizon}`
      )),
      ...(insight?.reasoningLog ?? report?.reasoningLog ?? []).slice(0, 2).map((entry) => entry.detail),
    ]).slice(0, 5),
    matchedFilters: [],
    verifiedSources: strategyAgentSources(match),
    scoring: strategyAgentScores(match),
  };
}

function synthesizeStrategyAgentGraphInsights(
  match: { report?: StrategyAgentReport; insight?: StrategyAgentInsight },
  resultId: string,
): CopilotQueryResponse['graphInsights'] {
  const insight = match.insight;
  const report = match.report;
  const predictions = insight?.predictions ?? report?.predictions ?? [];
  if (predictions.length === 0) {
    return [];
  }

  const type: CopilotGraphInsight['type'] = (insight?.agentType ?? report?.agentType) === 'NETWORK_EVOLUTION'
    ? 'PUBLICATION_NETWORK'
    : 'SOURCE_COVERAGE';
  const title = insight?.headline ?? report?.headline ?? 'Strategy agent report';

  return [{
    resultId,
    type,
    summary: `${title} cites ${predictions.length} linked prediction(s) from the strategy agent layer.`,
    path: [title, ...predictions.slice(0, 2).map((prediction) => prediction.predictionId)],
    depth: 1,
  }];
}

export async function augmentWithStrategySupport(
  response: CopilotQueryResponse,
  rawQuery: string,
): Promise<CopilotQueryResponse> {
  if (!strategyIntentRequested(rawQuery)) {
    return response;
  }

  const insights = await searchStrategyInsightsForCopilot({
    query: rawQuery,
    limit: 3,
    entityType: strategyEntityTypeHint(rawQuery),
  });

  if (insights.length === 0) {
    const agentMatches = await searchStrategyAgentArtifacts(rawQuery, 3);
    if (agentMatches.length === 0) {
      return response;
    }

    const agentResults = agentMatches.map((match, index) => (
      synthesizeStrategyAgentResult(
        {
          report: match.report,
          insight: match.insight,
        },
        index + 1,
      )
    ));
    const agentExplanations = agentResults.map((result, index) => (
      synthesizeStrategyAgentExplanation(
        {
          report: agentMatches[index]?.report,
          insight: agentMatches[index]?.insight,
        },
        result.id,
      )
    ));
    const agentGraphInsights = agentResults.flatMap((result, index) => (
      synthesizeStrategyAgentGraphInsights(
        {
          report: agentMatches[index]?.report,
          insight: agentMatches[index]?.insight,
        },
        result.id,
      )
    ));

    return {
      ...response,
      results: [...agentResults, ...response.results].slice(0, Math.max(response.results.length, agentResults.length)),
      explanations: [...agentExplanations, ...response.explanations],
      graphInsights: [...agentGraphInsights, ...response.graphInsights].slice(0, Math.max(response.graphInsights.length, agentGraphInsights.length, 5)),
    };
  }

  const syntheticResults = insights.map((insight, index) =>
    synthesizeStrategyResult(insight, index + 1));
  const syntheticExplanations = syntheticResults.map((result, index) =>
    synthesizeStrategyExplanation(insights[index]!, result.id));
  const syntheticGraphInsights = syntheticResults.flatMap((result, index) =>
    synthesizeStrategyGraphInsights(insights[index]!, result.id));
  const agentMatches = await searchStrategyAgentArtifacts(rawQuery, 2);
  const agentResults = agentMatches.map((match, index) => (
    synthesizeStrategyAgentResult(
      {
        report: match.report,
        insight: match.insight,
      },
      syntheticResults.length + index + 1,
    )
  ));
  const agentExplanations = agentResults.map((result, index) => (
    synthesizeStrategyAgentExplanation(
      {
        report: agentMatches[index]?.report,
        insight: agentMatches[index]?.insight,
      },
      result.id,
    )
  ));
  const agentGraphInsights = agentResults.flatMap((result, index) => (
    synthesizeStrategyAgentGraphInsights(
      {
        report: agentMatches[index]?.report,
        insight: agentMatches[index]?.insight,
      },
      result.id,
    )
  ));

  return {
    ...response,
    results: [...syntheticResults, ...agentResults, ...response.results].slice(0, Math.max(response.results.length, syntheticResults.length + agentResults.length)),
    explanations: [...syntheticExplanations, ...agentExplanations, ...response.explanations],
    graphInsights: [...syntheticGraphInsights, ...agentGraphInsights, ...response.graphInsights].slice(0, Math.max(response.graphInsights.length, syntheticGraphInsights.length + agentGraphInsights.length, 5)),
  };
}

function computeFreshnessScore(isoValue: string | undefined): number {
  if (!isoValue) {
    return 0.2;
  }

  const timestamp = new Date(isoValue).getTime();
  if (Number.isNaN(timestamp)) {
    return 0.2;
  }

  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  if (ageDays <= 7) {
    return 1;
  }
  if (ageDays <= 30) {
    return 0.8;
  }
  if (ageDays <= 90) {
    return 0.55;
  }
  if (ageDays <= 180) {
    return 0.35;
  }
  return 0.15;
}

function lexicalSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.sqrt(leftTokens.size * rightTokens.size);
}

function inferredState(text: string): string | undefined {
  const upper = text.toUpperCase();
  const match = upper.match(/\b([A-Z]{2})\b/);
  return match?.[1];
}

function extractFields(metadata: Record<string, unknown>, fallbackTitle: string, fallbackSnippet: string): ExtractedCandidateFields {
  const specialty = asString(metadata.specialty) ?? asStringArray(metadata.specialties)[0];
  const state = asString(metadata.state) ?? asStringArray(metadata.states)[0] ?? inferredState(fallbackSnippet);
  const institution =
    asString(metadata.institution) ??
    asString(metadata.organization) ??
    asString(metadata.facility) ??
    asString(metadata.employerName) ??
    asString(metadata.groupName);
  const licenseStatus = asString(metadata.licenseStatus) ?? asString(metadata.status);
  const boardCertified =
    asBoolean(metadata.boardCertified) ??
    (typeof metadata.boardCertification === 'string'
      ? metadata.boardCertification.toLowerCase() === 'true'
      : undefined);
  const trustScore = asNumber(metadata.trustScore);
  const researchTopics = dedupeStrings([
    ...asStringArray(metadata.researchTopics),
    ...asStringArray(metadata.topics),
    ...asStringArray(metadata.tags),
    ...(specialty ? [specialty] : []),
  ]);
  const affiliations = dedupeStrings([
    ...asStringArray(metadata.affiliations),
    ...asStringArray(metadata.institutions),
    ...(institution ? [institution] : []),
  ]);
  const sourceCoverage = dedupeStrings([
    ...asStringArray(metadata.sources),
    ...asStringArray(metadata.verifiedSources),
    ...(asString(metadata.provenance) ? [asString(metadata.provenance)!] : []),
  ]);
  const npi = asString(metadata.npi) ?? asString(metadata.providerNpi);

  return {
    specialty,
    state,
    institution: institution ?? fallbackTitle,
    licenseStatus,
    boardCertified,
    trustScore,
    researchTopics,
    affiliations,
    sourceCoverage,
    npi,
  };
}

function resolveEntityTypeFromSearch(result: SearchResult, extracted: ExtractedCandidateFields): CopilotEntityType {
  const resultType = result.type.toLowerCase();
  if (resultType.includes('opportunity')) {
    return 'OPPORTUNITY';
  }
  if (resultType.includes('program') || resultType.includes('residency')) {
    return 'PROGRAM';
  }
  if (extracted.npi || resultType.includes('trust') || resultType.includes('clinician') || resultType.includes('provider')) {
    return 'CLINICIAN';
  }
  if (resultType.includes('employer') || resultType.includes('organization')) {
    return 'ORGANIZATION';
  }
  return 'DOCUMENT';
}

function resolveEntityTypeFromGraph(node: GraphNode, extracted: ExtractedCandidateFields): CopilotEntityType {
  if (node.type === 'clinician' || extracted.npi) {
    return 'CLINICIAN';
  }
  if (node.type === 'organization' || node.type === 'institution') {
    return 'ORGANIZATION';
  }
  if (node.type === 'program') {
    return 'PROGRAM';
  }
  return 'DOCUMENT';
}

function stableCandidateId(type: CopilotEntityType, params: {
  id: string;
  npi?: string;
  referenceId?: string;
  institution?: string;
}): string {
  if (type === 'CLINICIAN' && params.npi) {
    return `clinician:${params.npi}`;
  }

  if (type === 'ORGANIZATION') {
    return `organization:${params.referenceId ?? params.institution ?? params.id}`;
  }

  if (type === 'OPPORTUNITY') {
    return `opportunity:${params.referenceId ?? params.id}`;
  }

  if (type === 'PROGRAM') {
    return `program:${params.referenceId ?? params.id}`;
  }

  return `document:${params.referenceId ?? params.id}`;
}

function buildEvidence(sources: string[], summary: string, verifiedAt?: string, url?: string): CopilotEvidence[] {
  return sources.slice(0, 6).map((source) => ({
    source,
    sourceType: sourceTypeFor(source),
    summary,
    verifiedAt,
    url,
  }));
}

function pushMatch(matches: CopilotMatch[], match: CopilotMatch | null): void {
  if (match) {
    matches.push(match);
  }
}

function collectMatches(
  parsedQuery: ParsedCopilotQuery,
  candidate: {
    specialty?: string;
    state?: string;
    institution?: string;
    licenseStatus?: string;
    boardCertified?: boolean;
    trustScore?: number;
    researchTopics: string[];
    affiliations: string[];
    payments?: { total?: number; hasPayments: boolean };
    text: string;
  },
): CopilotMatch[] {
  const matches: CopilotMatch[] = [];
  const filters = parsedQuery.structuredFilters;

  if (candidate.specialty && filters.specialties.some((specialty) => candidate.specialty?.toLowerCase().includes(specialty.toLowerCase()))) {
    pushMatch(matches, {
      field: 'specialty',
      value: candidate.specialty,
      reason: `specialty matched ${candidate.specialty}`,
    });
  }

  if (candidate.state && filters.states.some((state) => candidate.state?.toUpperCase().includes(state.toUpperCase()))) {
    pushMatch(matches, {
      field: 'state',
      value: candidate.state,
      reason: `state matched ${candidate.state}`,
    });
  }

  if (candidate.institution && filters.institutions.some((institution) => candidate.institution?.toLowerCase().includes(institution.toLowerCase()))) {
    pushMatch(matches, {
      field: 'institution',
      value: candidate.institution,
      reason: `institution matched ${candidate.institution}`,
    });
  }

  if (
    candidate.licenseStatus &&
    filters.licenseStatuses.some((status) => candidate.licenseStatus?.toUpperCase().includes(status.toUpperCase()))
  ) {
    pushMatch(matches, {
      field: 'licenseStatus',
      value: candidate.licenseStatus,
      reason: `license status matched ${candidate.licenseStatus}`,
    });
  }

  if (filters.boardCertified !== undefined && candidate.boardCertified === filters.boardCertified) {
    pushMatch(matches, {
      field: 'boardCertification',
      value: candidate.boardCertified,
      reason: `board certification matched ${String(candidate.boardCertified)}`,
    });
  }

  if (candidate.trustScore !== undefined && filters.trustScore?.min !== undefined && candidate.trustScore >= filters.trustScore.min) {
    pushMatch(matches, {
      field: 'trustScore',
      value: candidate.trustScore,
      reason: `trust score matched threshold ${filters.trustScore.min}`,
    });
  }

  if (filters.researchTopics.length > 0 && candidate.researchTopics.some((topic) =>
    filters.researchTopics.some((researchTopic) => topic.toLowerCase().includes(researchTopic.toLowerCase())),
  )) {
    pushMatch(matches, {
      field: 'researchTopic',
      value: candidate.researchTopics[0] ?? filters.researchTopics[0] ?? 'research',
      reason: 'research topic matched query',
    });
  }

  if (filters.affiliations.length > 0 && candidate.affiliations.some((affiliation) =>
    filters.affiliations.some((filter) => affiliation.toLowerCase().includes(filter.toLowerCase())),
  )) {
    pushMatch(matches, {
      field: 'affiliation',
      value: candidate.affiliations[0] ?? filters.affiliations[0] ?? 'affiliation',
      reason: 'affiliation matched query',
    });
  }

  if (filters.payments === 'HAS_PAYMENTS' && candidate.payments?.hasPayments) {
    pushMatch(matches, {
      field: 'payments',
      value: candidate.payments.total ?? true,
      reason: 'payments evidence present',
    });
  }

  for (const keyword of parsedQuery.keywords.slice(0, 6)) {
    if (candidate.text.toLowerCase().includes(keyword.toLowerCase())) {
      pushMatch(matches, {
        field: 'keyword',
        value: keyword,
        reason: `keyword ${keyword} matched candidate text`,
      });
    }
  }

  return matches;
}

function candidateText(parts: Array<string | undefined>): string {
  return normalizeText(parts.filter((part): part is string => Boolean(part)).join(' '));
}

function searchResultToCandidate(
  result: SearchResult,
  parsedQuery: ParsedCopilotQuery,
  engine: 'STRUCTURED' | 'SEMANTIC',
  score: number,
  reason: string,
): CopilotCandidate {
  const extracted = extractFields(result.metadata, result.title, result.snippet);
  const type = resolveEntityTypeFromSearch(result, extracted);
  const text = candidateText([
    result.title,
    result.snippet,
    extracted.specialty,
    extracted.state,
    extracted.institution,
    extracted.researchTopics.join(' '),
    extracted.affiliations.join(' '),
  ]);
  const metadata = sanitizeMetadata({
    ...result.metadata,
    npi: extracted.npi,
    specialty: extracted.specialty,
    state: extracted.state,
    institution: extracted.institution,
  });

  return {
    id: stableCandidateId(type, {
      id: result.id,
      npi: extracted.npi,
      referenceId: result.referenceId,
      institution: extracted.institution,
    }),
    type,
    title: result.title,
    subtitle: extracted.specialty ?? extracted.institution,
    summary: result.snippet || result.title,
    specialty: extracted.specialty,
    state: extracted.state,
    institution: extracted.institution,
    licenseStatus: extracted.licenseStatus,
    boardCertified: extracted.boardCertified,
    trustScore: extracted.trustScore,
    trustBand: undefined,
    researchTopics: extracted.researchTopics,
    affiliations: extracted.affiliations,
    payments: undefined,
    freshness: {
      observedAt: result.freshAt,
      score: computeFreshnessScore(result.freshAt),
    },
    sourceCoverage: dedupeStrings([result.provenance, ...extracted.sourceCoverage]),
    evidence: buildEvidence(
      dedupeStrings([result.provenance, ...extracted.sourceCoverage]),
      `${result.type} indexed result`,
      result.freshAt,
      result.sourceUrl,
    ),
    engineHits: [{
      engine,
      score: Math.max(0, Math.min(1, score)),
      reasons: [reason],
    }],
    matches: collectMatches(parsedQuery, {
      specialty: extracted.specialty,
      state: extracted.state,
      institution: extracted.institution,
      licenseStatus: extracted.licenseStatus,
      boardCertified: extracted.boardCertified,
      trustScore: extracted.trustScore,
      researchTopics: extracted.researchTopics,
      affiliations: extracted.affiliations,
      text,
    }),
    graphSignals: [],
    metadata,
  };
}

function graphNodeToCandidate(
  node: GraphNode,
  parsedQuery: ParsedCopilotQuery,
  score: number,
  reason: string,
): CopilotCandidate {
  const extracted = extractFields(node.metadata, node.title, node.title);
  const type = resolveEntityTypeFromGraph(node, extracted);
  const text = candidateText([
    node.title,
    asString(node.metadata.description),
    extracted.specialty,
    extracted.state,
    extracted.institution,
    extracted.researchTopics.join(' '),
    extracted.affiliations.join(' '),
    node.tags.join(' '),
  ]);
  const sourceCoverage = dedupeStrings([...node.sourceRefs, ...extracted.sourceCoverage]);
  const metadata = sanitizeMetadata({
    ...node.metadata,
    npi: extracted.npi,
    specialty: extracted.specialty,
    state: extracted.state,
    institution: extracted.institution,
    graphNodeId: node.id,
  });

  return {
    id: stableCandidateId(type, {
      id: node.id,
      npi: extracted.npi,
      institution: extracted.institution,
    }),
    type,
    title: node.title,
    subtitle: extracted.specialty ?? node.type,
    summary: asString(node.metadata.description) ?? `${node.type} connected in the VitalCV graph`,
    specialty: extracted.specialty,
    state: extracted.state,
    institution: extracted.institution,
    licenseStatus: extracted.licenseStatus,
    boardCertified: extracted.boardCertified,
    trustScore: extracted.trustScore,
    trustBand: typeof node.trustBand === 'string' ? node.trustBand : undefined,
    researchTopics: dedupeStrings([...extracted.researchTopics, ...node.tags]),
    affiliations: extracted.affiliations,
    payments: undefined,
    freshness: {
      observedAt: node.updatedAt,
      score: computeFreshnessScore(node.updatedAt),
    },
    sourceCoverage,
    evidence: buildEvidence(sourceCoverage, `graph node ${node.type}`, node.updatedAt),
    engineHits: [{
      engine: 'GRAPH',
      score: Math.max(0, Math.min(1, score)),
      reasons: [reason],
    }],
    matches: [
      ...collectMatches(parsedQuery, {
        specialty: extracted.specialty,
        state: extracted.state,
        institution: extracted.institution,
        licenseStatus: extracted.licenseStatus,
        boardCertified: extracted.boardCertified,
        trustScore: extracted.trustScore,
        researchTopics: extracted.researchTopics,
        affiliations: extracted.affiliations,
        text,
      }),
      {
        field: 'graph',
        value: node.type,
        reason,
      },
    ],
    graphSignals: dedupeStrings([node.type, ...node.tags]),
    metadata,
  };
}

function buildSearchQuery(parsedQuery: ParsedCopilotQuery): string {
  const filters = parsedQuery.structuredFilters;
  const terms = [
    ...filters.specialties,
    ...filters.states,
    ...filters.institutions,
    ...filters.affiliations,
    ...parsedQuery.keywords,
  ];

  return dedupeStrings(terms).slice(0, 8).join(' ') || parsedQuery.rawQuery;
}

function buildSemanticQuery(parsedQuery: ParsedCopilotQuery): string {
  return dedupeStrings([
    parsedQuery.rawQuery,
    ...parsedQuery.semanticTopics,
  ]).join(' ');
}

function graphNodeTypesForPlan(prioritizedTypes: CopilotEntityType[]): NodeType[] {
  const nodeTypes = new Set<NodeType>();

  for (const type of prioritizedTypes) {
    if (type === 'CLINICIAN') {
      nodeTypes.add('clinician');
      nodeTypes.add('license');
      nodeTypes.add('credential');
    }

    if (type === 'ORGANIZATION') {
      nodeTypes.add('organization');
      nodeTypes.add('institution');
    }

    if (type === 'PROGRAM') {
      nodeTypes.add('program');
    }

    if (type === 'DOCUMENT') {
      nodeTypes.add('publication');
      nodeTypes.add('trial');
      nodeTypes.add('claim');
      nodeTypes.add('artifact');
      nodeTypes.add('source');
    }
  }

  return [...nodeTypes];
}

function semanticScore(parsedQuery: ParsedCopilotQuery, result: SearchResult): number {
  const metadata = result.metadata;
  const text = candidateText([
    result.title,
    result.snippet,
    asString(metadata.specialty),
    asString(metadata.state),
    asString(metadata.institution),
    asStringArray(metadata.tags).join(' '),
    asStringArray(metadata.topics).join(' '),
    asStringArray(metadata.researchTopics).join(' '),
  ]);

  return lexicalSimilarity(buildSemanticQuery(parsedQuery), text);
}

function structuredScore(parsedQuery: ParsedCopilotQuery, result: SearchResult): number {
  const metadata = result.metadata;
  const text = candidateText([
    result.title,
    result.snippet,
    asString(metadata.specialty),
    asString(metadata.state),
    asString(metadata.institution),
  ]);

  return Math.max(
    Math.min(result.score / 10, 1),
    lexicalSimilarity(buildSearchQuery(parsedQuery), text),
  );
}

function bestFocusNode(nodes: GraphNode[], parsedQuery: ParsedCopilotQuery): GraphNode | null {
  const searchText = buildSearchQuery(parsedQuery);
  const ranked = nodes
    .map((node) => ({
      node,
      score: lexicalSimilarity(searchText, candidateText([
        node.title,
        asString(node.metadata.description),
        asString(node.metadata.specialty),
        asString(node.metadata.organization),
      ])),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score && ranked[0].score > 0 ? ranked[0].node : null;
}

function buildDistanceMap(result: GraphQueryResult): Map<string, { depth: number; parent?: string }> {
  const focusNodeId = result.focusNodeId;
  const distances = new Map<string, { depth: number; parent?: string }>();

  if (!focusNodeId) {
    return distances;
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of result.chunk.edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  }

  const queue: Array<{ nodeId: string; depth: number; parent?: string }> = [{ nodeId: focusNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || distances.has(current.nodeId)) {
      continue;
    }

    distances.set(current.nodeId, { depth: current.depth, parent: current.parent });

    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (!distances.has(neighbor)) {
        queue.push({ nodeId: neighbor, depth: current.depth + 1, parent: current.nodeId });
      }
    }
  }

  return distances;
}

function rebuildPath(nodeId: string, nodesById: Map<string, GraphNode>, distances: Map<string, { depth: number; parent?: string }>): string[] {
  const path: string[] = [];
  let current: string | undefined = nodeId;

  while (current) {
    const node = nodesById.get(current);
    if (node) {
      path.unshift(node.title);
    }
    current = distances.get(current)?.parent;
  }

  return path;
}

function graphInsightType(parsedQuery: ParsedCopilotQuery): CopilotGraphInsight['type'] {
  if (parsedQuery.graphTraversal.includes('COLLABORATORS')) {
    return 'COLLABORATOR';
  }
  if (parsedQuery.graphTraversal.includes('TRIAL_INVESTIGATORS')) {
    return 'TRIAL_INVESTIGATOR';
  }
  if (parsedQuery.graphTraversal.includes('PUBLICATION_NETWORKS')) {
    return 'PUBLICATION_NETWORK';
  }
  if (parsedQuery.graphTraversal.includes('INSTITUTION_CONNECTIONS')) {
    return 'INSTITUTION_CONNECTION';
  }
  return 'NEIGHBOR';
}

async function runStructuredSearch(
  context: CopilotSearchContext,
  requestContext: SearchRequestContext,
): Promise<CopilotCandidate[]> {
  if (context.plan.stageBudgets.structured === 0) {
    return [];
  }

  const response = await querySearch({
    q: buildSearchQuery(context.parsedQuery),
    aclLevel: requestContext.aclLevel,
    orgId: requestContext.organizationId,
    roles: requestContext.membershipRoles,
    limit: context.plan.stageBudgets.structured,
    filters: {
      state: context.parsedQuery.structuredFilters.states[0],
    },
  });

  return response.results
    .map((result) => ({
      result,
      score: structuredScore(context.parsedQuery, result),
    }))
    .filter((entry) => entry.score >= 0.12)
    .map(({ result, score }) =>
      searchResultToCandidate(
        result,
        context.parsedQuery,
        'STRUCTURED',
        score,
        'structured index match across identity and content fields',
      ))
    .slice(0, context.plan.stageBudgets.structured);
}

async function runSemanticSearch(
  context: CopilotSearchContext,
  requestContext: SearchRequestContext,
): Promise<CopilotCandidate[]> {
  if (context.plan.stageBudgets.semantic === 0) {
    return [];
  }

  const response: SearchResponse = await querySearch({
    q: buildSemanticQuery(context.parsedQuery),
    aclLevel: requestContext.aclLevel,
    orgId: requestContext.organizationId,
    roles: requestContext.membershipRoles,
    limit: context.plan.stageBudgets.semantic,
  });

  return response.results
    .map((result) => ({
      result,
      score: semanticScore(context.parsedQuery, result),
    }))
    .filter((entry) => entry.score >= 0.08)
    .map(({ result, score }) =>
      searchResultToCandidate(
        result,
        context.parsedQuery,
        'SEMANTIC',
        score,
        'semantic similarity across biography, publication, trial, and claims text',
      ))
    .slice(0, context.plan.stageBudgets.semantic);
}

async function runGraphSearch(context: CopilotSearchContext): Promise<{
  candidates: CopilotCandidate[];
  insights: CopilotGraphInsight[];
}> {
  if (context.plan.stageBudgets.graph === 0) {
    return { candidates: [], insights: [] };
  }

  const nodeTypes = graphNodeTypesForPlan(context.plan.prioritizedTypes);
  const globalResult = await queryGraph({
    graphMode: 'blended',
    scope: 'global',
    nodeTypes,
    searchTerm: buildSearchQuery(context.parsedQuery),
    depth: 1,
    limit: context.plan.stageBudgets.graph,
  });

  const focusNode = bestFocusNode(globalResult.chunk.nodes, context.parsedQuery);
  const localResult = focusNode
    ? await queryGraph({
        graphMode: 'blended',
        scope: 'local',
        focusNodeId: focusNode.id,
        nodeTypes,
        depth: context.plan.graphDepth,
        limit: context.plan.stageBudgets.graph,
      })
    : null;

  const candidates = [
    ...globalResult.chunk.nodes.map((node) =>
      graphNodeToCandidate(node, context.parsedQuery, lexicalSimilarity(buildSearchQuery(context.parsedQuery), node.title), 'graph search matched query focus'),
    ),
    ...(localResult?.chunk.nodes ?? []).map((node) =>
      graphNodeToCandidate(node, context.parsedQuery, node.id === focusNode?.id ? 1 : 0.75, 'graph traversal connected to query focus'),
    ),
  ];

  if (!localResult || !focusNode) {
    return {
      candidates,
      insights: [],
    };
  }

  const nodesById = new Map(localResult.chunk.nodes.map((node) => [node.id, node]));
  const distances = buildDistanceMap(localResult);
  const insightType = graphInsightType(context.parsedQuery);
  const insights = localResult.chunk.nodes
    .filter((node) => node.id !== focusNode.id)
    .map((node) => ({
      resultId: graphNodeToCandidate(node, context.parsedQuery, 0.75, 'graph traversal connected to query focus').id,
      type: insightType,
      summary: `${node.title} is connected to ${focusNode.title}.`,
      path: rebuildPath(node.id, nodesById, distances),
      depth: distances.get(node.id)?.depth ?? 1,
    }))
    .slice(0, context.plan.stageBudgets.graph);

  return { candidates, insights };
}

function candidateNpi(candidate: CopilotCandidate): string | undefined {
  const metadataNpi = candidate.metadata.npi;
  return typeof metadataNpi === 'string' && metadataNpi.trim().length > 0 ? metadataNpi : undefined;
}

async function runTrustSearch(
  candidates: CopilotCandidate[],
  context: CopilotSearchContext,
): Promise<CopilotTrustEnrichment[]> {
  if (context.plan.stageBudgets.trust === 0) {
    return [];
  }

  const uniqueCandidates = new Map<string, CopilotCandidate>();
  for (const candidate of candidates) {
    uniqueCandidates.set(candidate.id, candidate);
  }

  const enrichments = await Promise.all(
    [...uniqueCandidates.values()]
      .slice(0, context.plan.stageBudgets.trust)
      .map(async (candidate) => {
        const npi = candidateNpi(candidate);
        if (!npi) {
          if (candidate.trustScore === undefined) {
            return null;
          }

          return {
            id: candidate.id,
            trustScore: candidate.trustScore,
            trustBand: candidate.trustBand,
            verifiedSources: candidate.sourceCoverage,
            trustReasons: [`trust score = ${candidate.trustScore}`],
          } satisfies CopilotTrustEnrichment;
        }

        const trust = await computeTrustScoreV1(npi);
        const verifiedSources = dedupeStrings(
          Object.values(trust.dimensions).flatMap((dimension) => dimension.sources),
        );

        return {
          id: candidate.id,
          trustScore: trust.score,
          trustBand: trust.band,
          verifiedSources,
          trustReasons: [`trust band ${trust.band}`, `confidence ${(trust.confidence * 100).toFixed(0)}%`],
        } satisfies CopilotTrustEnrichment;
      }),
  );

  return enrichments.filter((enrichment): enrichment is NonNullable<typeof enrichments[number]> => enrichment !== null);
}

function buildDependencies(requestContext: SearchRequestContext): CopilotDependencies {
  return {
    structuredSearch: async (context) =>
      withToolSpan(
        {
          toolName: 'copilot.structured_search',
          input: {
            filters: context.parsedQuery.structuredFilters,
            limit: context.plan.stageBudgets.structured,
          },
        },
        async () => runStructuredSearch(context, requestContext),
      ),
    semanticSearch: async (context) =>
      withToolSpan(
        {
          toolName: 'copilot.semantic_search',
          input: {
            semanticTopics: context.parsedQuery.semanticTopics,
            limit: context.plan.stageBudgets.semantic,
          },
        },
        async () => runSemanticSearch(context, requestContext),
      ),
    graphSearch: async (context) =>
      withToolSpan(
        {
          toolName: 'copilot.graph_search',
          input: {
            graphTraversal: context.parsedQuery.graphTraversal,
            limit: context.plan.stageBudgets.graph,
            depth: context.plan.graphDepth,
          },
        },
        async () => runGraphSearch(context),
      ),
    trustSearch: async (context) =>
      withToolSpan(
        {
          toolName: 'copilot.trust_search',
          input: {
            candidates: context.candidates.map((candidate) => candidate.id),
            limit: context.plan.stageBudgets.trust,
          },
        },
        async () => runTrustSearch(context.candidates, context),
      ),
  };
}

export async function executeCopilotQuery(params: {
  query: string;
  limit: number;
  requestContext: SearchRequestContext;
}): Promise<CopilotQueryResponse> {
  const preparedQuery = prepareCopilotQuery({
    query: params.query,
    limit: params.limit,
  });

  // Storyline-first: if query references a storyline ID, return narrative directly
  const storylineResponse = await maybeExecuteStorylineCopilotQuery(preparedQuery, params.limit);
  if (storylineResponse) {
    log('info', 'copilot.query', {
      queryHash: params.requestContext.queryHash,
      intent: storylineResponse.parsedQuery.intent,
      resultCount: storylineResponse.results.length,
      storylineMode: true,
    });
    return storylineResponse;
  }

  const intelligenceContextResponse = await maybeExecuteIntelligenceContextQuery(preparedQuery, params.limit);
  if (intelligenceContextResponse) {
    log('info', 'copilot.query', {
      queryHash: params.requestContext.queryHash,
      intent: intelligenceContextResponse.parsedQuery.intent,
      resultCount: intelligenceContextResponse.results.length,
      graphInsightCount: intelligenceContextResponse.graphInsights.length,
      intelligenceContextMode: true,
    });

    return intelligenceContextResponse;
  }

  const predictionResponse = await maybeExecutePredictionCopilotQuery(preparedQuery, params.limit);
  if (predictionResponse) {
    log('info', 'copilot.query', {
      queryHash: params.requestContext.queryHash,
      intent: predictionResponse.parsedQuery.intent,
      resultCount: predictionResponse.results.length,
      graphInsightCount: predictionResponse.graphInsights.length,
      predictionMode: true,
    });

    return predictionResponse;
  }

  const response = await executeCopilotPlan(
    preparedQuery,
    buildDependencies(params.requestContext),
  );
  const decisionEnrichedResponse = await augmentWithDecisionSupport(response, params.query);
  const enrichedResponse = await augmentWithStrategySupport(decisionEnrichedResponse, params.query);

  log('info', 'copilot.query', {
    queryHash: params.requestContext.queryHash,
    intent: enrichedResponse.parsedQuery.intent,
    resultCount: enrichedResponse.results.length,
    graphInsightCount: enrichedResponse.graphInsights.length,
  });

  return enrichedResponse;
}
