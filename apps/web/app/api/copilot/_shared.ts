import { getBackendBase } from '@/lib/api';
import type {
  CopilotAskResponsePayload,
  CopilotDocument,
  CopilotDocumentMode,
  CopilotQueryLimitedResponsePayload,
  CopilotQueryResponsePayload,
} from '@/lib/copilot/contracts';
import {
  buildForwardHeaders,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../intelligence/_shared';

const BACKEND = getBackendBase();

export const COPILOT_FALLBACK_MESSAGE = 'Copilot requires active investigation context.';
export const COPILOT_SIGN_IN_MESSAGE = 'Copilot requires sign-in for full analysis';
export const COPILOT_FALLBACK_SUGGESTIONS = [
  'Open an investigation',
  'Review recent findings',
  'Focus the trust graph',
];

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

interface CopilotFallbackContextEvidenceItem {
  source?: string | null;
  claim?: string | null;
  confidence?: number | null;
  observedAt?: string | null;
  field?: string | null;
  corroborationCount?: number | null;
}

interface CopilotFallbackContext {
  scope?: string | null;
  provider?: {
    npi?: string | null;
    label?: string | null;
    specialty?: string | null;
    state?: string | null;
    trustScore?: number | null;
    trustBand?: string | null;
    trustConfidence?: number | null;
    activeFindings?: number | null;
  } | null;
  finding?: {
    id?: string | null;
    findingType?: string | null;
    title?: string | null;
    severity?: string | null;
    status?: string | null;
    summary?: string | null;
    explanation?: string | null;
    confidence?: number | null;
    priorityScore?: number | null;
    evidence?: CopilotFallbackContextEvidenceItem[] | null;
    storylineId?: string | null;
    storylineTitle?: string | null;
    providerNpi?: string | null;
    npis?: string[] | null;
  } | null;
  storyline?: {
    id?: string | null;
    title?: string | null;
    storylineType?: string | null;
    severity?: string | null;
    status?: string | null;
    narrative?: string | null;
    whyItMatters?: string | null;
    confidence?: number | null;
    findingCount?: number | null;
    entityCount?: number | null;
    progressionScore?: number | null;
    evidence?: CopilotFallbackContextEvidenceItem[] | null;
    providerNpi?: string | null;
    recommendedActions?: string[] | null;
    lastActivityAt?: string | null;
  } | null;
  graph?: {
    focusNodeId?: string | null;
    selectedNodeId?: string | null;
    neighborNodeIds?: string[] | null;
    neighborEdgeIds?: string[] | null;
  } | null;
  recentFindings?: Array<{
    id?: string | null;
    title?: string | null;
    summary?: string | null;
    severity?: string | null;
    priorityScore?: number | null;
    href?: string | null;
  }> | null;
  evidenceSummary?: Array<{
    label?: string | null;
    detail?: string | null;
    source?: string | null;
    observedAt?: string | null;
  }> | null;
  riskSummary?: {
    trustScore?: number | null;
    trustBand?: string | null;
    trustConfidence?: number | null;
    summary?: string | null;
  } | null;
}

interface CopilotQueryRequestPayload {
  query?: string | null;
  context?: CopilotFallbackContext | null;
}

type LimitedEvidenceLike = {
  field?: string | null;
  label?: string | null;
  source?: string | null;
  claim?: string | null;
  detail?: string | null;
  confidence?: number | null;
  observedAt?: string | null;
};

function parseFallbackContext(value: unknown): CopilotFallbackContext | null {
  if (!isRecord(value)) {
    return null;
  }

  const provider: CopilotFallbackContext['provider'] = isRecord(value.provider)
    ? {
        npi: asText(value.provider.npi),
        label: asText(value.provider.label),
        specialty: asText(value.provider.specialty),
        state: asText(value.provider.state),
        trustScore: typeof value.provider.trustScore === 'number' && Number.isFinite(value.provider.trustScore)
          ? value.provider.trustScore
          : null,
        trustBand: asText(value.provider.trustBand),
        trustConfidence: typeof value.provider.trustConfidence === 'number' && Number.isFinite(value.provider.trustConfidence)
          ? value.provider.trustConfidence
          : null,
        activeFindings: typeof value.provider.activeFindings === 'number' && Number.isFinite(value.provider.activeFindings)
          ? value.provider.activeFindings
          : null,
      }
    : null;

  const finding: CopilotFallbackContext['finding'] = isRecord(value.finding)
    ? {
        id: asText(value.finding.id),
        findingType: asText(value.finding.findingType),
        title: asText(value.finding.title),
        severity: asText(value.finding.severity),
        status: asText(value.finding.status),
        summary: asText(value.finding.summary),
        explanation: asText(value.finding.explanation),
        confidence: typeof value.finding.confidence === 'number' && Number.isFinite(value.finding.confidence)
          ? value.finding.confidence
          : null,
        priorityScore: typeof value.finding.priorityScore === 'number' && Number.isFinite(value.finding.priorityScore)
          ? value.finding.priorityScore
          : null,
        evidence: Array.isArray(value.finding.evidence)
          ? value.finding.evidence
              .map((entry) => (isRecord(entry)
                ? {
                    source: asText(entry.source),
                    claim: asText(entry.claim),
                    confidence: typeof entry.confidence === 'number' && Number.isFinite(entry.confidence)
                      ? entry.confidence
                      : null,
                    observedAt: asText(entry.observedAt),
                    field: asText(entry.field),
                    corroborationCount: typeof entry.corroborationCount === 'number' && Number.isFinite(entry.corroborationCount)
                      ? entry.corroborationCount
                      : null,
                  }
                : null))
              .filter(isPresent)
          : null,
        storylineId: asText(value.finding.storylineId),
        storylineTitle: asText(value.finding.storylineTitle),
        providerNpi: asText(value.finding.providerNpi),
        npis: asStringArray(value.finding.npis),
      }
    : null;

  const storyline: CopilotFallbackContext['storyline'] = isRecord(value.storyline)
    ? {
        id: asText(value.storyline.id),
        title: asText(value.storyline.title),
        storylineType: asText(value.storyline.storylineType),
        severity: asText(value.storyline.severity),
        status: asText(value.storyline.status),
        narrative: asText(value.storyline.narrative),
        whyItMatters: asText(value.storyline.whyItMatters),
        confidence: typeof value.storyline.confidence === 'number' && Number.isFinite(value.storyline.confidence)
          ? value.storyline.confidence
          : null,
        findingCount: typeof value.storyline.findingCount === 'number' && Number.isFinite(value.storyline.findingCount)
          ? value.storyline.findingCount
          : null,
        entityCount: typeof value.storyline.entityCount === 'number' && Number.isFinite(value.storyline.entityCount)
          ? value.storyline.entityCount
          : null,
        progressionScore: typeof value.storyline.progressionScore === 'number' && Number.isFinite(value.storyline.progressionScore)
          ? value.storyline.progressionScore
          : null,
        evidence: Array.isArray(value.storyline.evidence)
          ? value.storyline.evidence
              .map((entry) => (isRecord(entry)
                ? {
                    source: asText(entry.source),
                    claim: asText(entry.claim),
                    confidence: typeof entry.confidence === 'number' && Number.isFinite(entry.confidence)
                      ? entry.confidence
                      : null,
                    observedAt: asText(entry.observedAt),
                    field: asText(entry.field),
                    corroborationCount: typeof entry.corroborationCount === 'number' && Number.isFinite(entry.corroborationCount)
                      ? entry.corroborationCount
                      : null,
                  }
                : null))
              .filter(isPresent)
          : null,
        providerNpi: asText(value.storyline.providerNpi),
        recommendedActions: asStringArray(value.storyline.recommendedActions),
        lastActivityAt: asText(value.storyline.lastActivityAt),
      }
    : null;

  const graph: CopilotFallbackContext['graph'] = isRecord(value.graph)
    ? {
        focusNodeId: asText(value.graph.focusNodeId),
        selectedNodeId: asText(value.graph.selectedNodeId),
        neighborNodeIds: asStringArray(value.graph.neighborNodeIds),
        neighborEdgeIds: asStringArray(value.graph.neighborEdgeIds),
      }
    : null;

  const recentFindings: CopilotFallbackContext['recentFindings'] = Array.isArray(value.recentFindings)
    ? value.recentFindings
        .map((entry) => (isRecord(entry)
          ? {
              id: asText(entry.id),
              title: asText(entry.title),
              summary: asText(entry.summary),
              severity: asText(entry.severity),
              priorityScore: typeof entry.priorityScore === 'number' && Number.isFinite(entry.priorityScore)
                ? entry.priorityScore
                : null,
              href: asText(entry.href),
            }
          : null))
        .filter(isPresent)
    : null;

  const evidenceSummary: CopilotFallbackContext['evidenceSummary'] = Array.isArray(value.evidenceSummary)
    ? value.evidenceSummary
        .map((entry) => (isRecord(entry)
          ? {
              label: asText(entry.label),
              detail: asText(entry.detail),
              source: asText(entry.source),
              observedAt: asText(entry.observedAt),
            }
          : null))
        .filter(isPresent)
    : null;

  const riskSummary: CopilotFallbackContext['riskSummary'] = isRecord(value.riskSummary)
    ? {
        trustScore: typeof value.riskSummary.trustScore === 'number' && Number.isFinite(value.riskSummary.trustScore)
          ? value.riskSummary.trustScore
          : null,
        trustBand: asText(value.riskSummary.trustBand),
        trustConfidence: typeof value.riskSummary.trustConfidence === 'number' && Number.isFinite(value.riskSummary.trustConfidence)
          ? value.riskSummary.trustConfidence
          : null,
        summary: asText(value.riskSummary.summary),
      }
    : null;

  return {
    scope: asText(value.scope),
    provider,
    finding,
    storyline,
    graph,
    recentFindings,
    evidenceSummary,
    riskSummary,
  };
}

function parseQueryRequest(body: string): CopilotQueryRequestPayload {
  if (!body.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    return {
      query: asText(parsed.query),
      context: parseFallbackContext(parsed.context),
    };
  } catch {
    return {};
  }
}

function scopeLabel(context: CopilotFallbackContext | null | undefined): string | null {
  if (context?.finding?.title) {
    return `Finding ${context.finding.title}`;
  }

  if (context?.storyline?.title) {
    return `Storyline ${context.storyline.title}`;
  }

  if (context?.provider?.label) {
    return `Provider ${context.provider.label}`;
  }

  if (context?.provider?.npi) {
    return `Provider NPI ${context.provider.npi}`;
  }

  if (context?.graph?.selectedNodeId) {
    return `Graph node ${context.graph.selectedNodeId}`;
  }

  if (context?.graph?.focusNodeId) {
    return `Graph node ${context.graph.focusNodeId}`;
  }

  if ((context?.recentFindings?.length ?? 0) > 0) {
    return `${context?.recentFindings?.length ?? 0} recent findings`;
  }

  return null;
}

function buildContextualSuggestions(context: CopilotFallbackContext | null | undefined): string[] {
  const suggestions: string[] = [];

  if (context?.finding?.id && context.finding.title) {
    suggestions.push(`Open the evidence chain for ${context.finding.title}`);
    suggestions.push(`Trace the storyline linked to ${context.finding.title}`);
  }

  if (context?.provider?.npi) {
    const providerLabel = context.provider.label ?? `NPI ${context.provider.npi}`;
    suggestions.push(`Review live findings for ${providerLabel}`);
    suggestions.push(`Focus the graph around ${providerLabel}`);
  }

  if (context?.storyline?.id && context.storyline.title) {
    suggestions.push(`Summarize storyline ${context.storyline.title}`);
    suggestions.push(`Inspect the findings tied to ${context.storyline.title}`);
  }

  if (context?.graph?.selectedNodeId || context?.graph?.focusNodeId) {
    suggestions.push('Highlight the current graph neighborhood');
  }

  if (suggestions.length === 0) {
    suggestions.push('Open an investigation');
    suggestions.push('Review recent findings');
    suggestions.push('Focus the trust graph');
  }

  return [...new Set(suggestions)].slice(0, 4);
}

function buildContextualMessage(
  context: CopilotFallbackContext | null | undefined,
  message: string,
): string {
  const label = scopeLabel(context);
  if (!label) {
    return message;
  }

  return `${label} is loaded from the current investigation context. ${message}`;
}

function buildLimitedDocument(
  title: string,
  message: string,
  suggestions: string[],
  mode: CopilotDocumentMode = 'summary',
  context: CopilotFallbackContext | null = null,
): CopilotDocument {
  const label = scopeLabel(context);
  const provider = context?.provider;
  const finding = context?.finding;
  const storyline = context?.storyline;
  const graph = context?.graph;

  const summaryItems = [
    provider ? {
      id: 'limited:provider',
      title: provider.label ?? `Provider ${provider.npi ?? 'unknown'}`,
      body: [
        provider.specialty,
        provider.state,
        typeof provider.trustScore === 'number' ? `trust ${Math.round(provider.trustScore)}` : null,
        provider.trustBand,
        typeof provider.activeFindings === 'number' ? `${provider.activeFindings} active finding${provider.activeFindings === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
    finding ? {
      id: 'limited:finding',
      title: finding.title ?? 'Active finding',
      body: [
        finding.findingType ? finding.findingType.replace(/_/g, ' ') : null,
        finding.severity,
        finding.status,
        finding.summary ?? finding.explanation,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
    storyline ? {
      id: 'limited:storyline',
      title: storyline.title ?? 'Active storyline',
      body: [
        storyline.storylineType ? storyline.storylineType.replace(/_/g, ' ') : null,
        storyline.severity,
        storyline.status,
        storyline.whyItMatters,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
    graph?.selectedNodeId || graph?.focusNodeId ? {
      id: 'limited:graph',
      title: 'Graph focus',
      body: [
        graph.selectedNodeId ? `selected ${graph.selectedNodeId}` : null,
        graph.focusNodeId ? `focus ${graph.focusNodeId}` : null,
        typeof graph.neighborNodeIds?.length === 'number' ? `${graph.neighborNodeIds.length} neighboring node${graph.neighborNodeIds.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const evidenceSource: LimitedEvidenceLike[] = [
    ...(finding?.evidence ?? []),
    ...(storyline?.evidence ?? []),
    ...((context?.evidenceSummary ?? []) as LimitedEvidenceLike[]),
  ];

  const evidenceItems = evidenceSource.slice(0, 4).map((entry, index) => ({
    id: `limited:evidence:${index}`,
    title: entry.field ?? entry.label ?? `Evidence ${index + 1}`,
    body: [
      entry.source,
      entry.claim ?? entry.detail,
      typeof entry.confidence === 'number' ? `confidence ${Math.round(entry.confidence * 100)}%` : null,
      entry.observedAt ? `observed ${entry.observedAt}` : null,
    ].filter(Boolean).join(' · '),
    availability: 'ready' as const,
  }));

  const signalItems = [
    context?.riskSummary?.summary ? {
      id: 'limited:risk',
      title: 'Current risk summary',
      body: context.riskSummary.summary,
      availability: 'ready' as const,
    } : null,
    context?.riskSummary?.trustScore !== undefined || context?.riskSummary?.trustBand ? {
      id: 'limited:trust',
      title: 'Trust posture',
      body: [
        typeof context?.riskSummary?.trustScore === 'number' ? `score ${Math.round(context.riskSummary.trustScore)}` : null,
        context?.riskSummary?.trustBand,
        typeof context?.riskSummary?.trustConfidence === 'number' ? `confidence ${Math.round(context.riskSummary.trustConfidence * 100)}%` : null,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
    (context?.recentFindings?.length ?? 0) > 0 ? {
      id: 'limited:recent-findings',
      title: 'Recent findings',
      body: `${context?.recentFindings?.length ?? 0} finding${(context?.recentFindings?.length ?? 0) === 1 ? '' : 's'} remain in scope.`,
      availability: 'ready' as const,
    } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const networkItems = [
    label ? {
      id: 'limited:scope',
      title: label,
      body: 'This scope remains available locally even when live sources are limited.',
      availability: 'limited' as const,
    } : null,
    provider?.npi ? {
      id: 'limited:provider-network',
      title: 'Provider graph anchor',
      body: [
        provider.label ?? `NPI ${provider.npi}`,
        graph?.selectedNodeId ? `selected node ${graph.selectedNodeId}` : null,
        graph?.focusNodeId ? `focus node ${graph.focusNodeId}` : null,
      ].filter(Boolean).join(' · '),
      availability: 'ready' as const,
    } : null,
    (graph?.neighborNodeIds?.length ?? 0) > 0 ? {
      id: 'limited:neighbors',
      title: 'Visible neighborhood',
      body: `${graph?.neighborNodeIds?.length ?? 0} neighboring node${(graph?.neighborNodeIds?.length ?? 0) === 1 ? '' : 's'} are in the current graph slice.`,
      availability: 'ready' as const,
    } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const followUpSuggestions = suggestions.length > 0 ? suggestions : buildContextualSuggestions(context);
  const recommendedAction = suggestions[0] ?? followUpSuggestions[0] ?? 'Open an investigation';

  return {
    mode,
    title,
    subtitle: label ?? undefined,
    generatedAt: new Date().toISOString(),
    suggestions,
    sections: [
      {
        key: 'summary',
        title: 'SUMMARY',
        availability: summaryItems.length > 0 ? 'ready' : 'limited',
        summary: message,
        items: summaryItems.length > 0
          ? summaryItems.map((entry) => ({
              id: entry.id,
              title: entry.title,
              body: entry.body,
              availability: entry.availability,
            }))
          : [{
              id: 'limited-summary',
              title,
              body: message,
              availability: 'limited',
            }],
      },
      {
        key: 'evidence',
        title: 'EVIDENCE',
        availability: evidenceItems.length > 0 ? 'ready' : 'unavailable',
        items: evidenceItems,
      },
      {
        key: 'signals',
        title: 'SIGNALS',
        availability: signalItems.length > 0 ? 'ready' : 'unavailable',
        items: signalItems,
      },
      {
        key: 'network_context',
        title: 'NETWORK CONTEXT',
        availability: networkItems.length > 0 ? 'ready' : 'unavailable',
        items: networkItems,
      },
      {
        key: 'recommended_action',
        title: 'RECOMMENDED ACTION',
        availability: 'ready',
        items: [{
          id: 'limited-recommended-action',
          title: 'Next action',
          body: recommendedAction,
          availability: 'limited',
        }],
      },
      {
        key: 'follow_up_questions',
        title: 'FOLLOW-UP QUESTIONS',
        availability: followUpSuggestions.length > 0 ? 'ready' : 'unavailable',
        items: followUpSuggestions.map((suggestion, index) => ({
          id: `limited-follow-up-${index}`,
          title: suggestion,
          body: context?.scope ? `${context.scope} context available.` : 'Use the current investigation context to continue.',
          availability: 'ready',
        })),
      },
    ],
  };
}

export function buildCopilotQueryFallback(input: {
  title?: string;
  message?: string;
  suggestions?: string[];
  mode?: CopilotDocumentMode;
} = {}, context: CopilotFallbackContext | null = null): CopilotQueryLimitedResponsePayload {
  const title = input.title ?? `${scopeLabel(context) ?? 'Copilot'} · limited response`;
  const message = buildContextualMessage(context, input.message ?? COPILOT_FALLBACK_MESSAGE);
  const suggestions = input.suggestions?.length
    ? [...input.suggestions]
    : buildContextualSuggestions(context);

  return {
    status: 'limited',
    title,
    message,
    suggestions,
    answer: message,
    sources: [],
    confidence: 0,
    results: [],
    explanations: [],
    graphInsights: [],
    document: buildLimitedDocument(title, message, suggestions, input.mode, context),
  };
}

function buildAuthLimitedFallback(
  status: Awaited<ReturnType<typeof resolveIntelligenceAuthContext>>['status'],
  context: CopilotFallbackContext | null = null,
): CopilotQueryLimitedResponsePayload {
  if (status === 'missing_session') {
    return buildCopilotQueryFallback({
      title: `${scopeLabel(context) ?? 'Copilot'} · limited response`,
      message: COPILOT_SIGN_IN_MESSAGE,
      suggestions: buildContextualSuggestions(context),
    }, context);
  }

  return buildCopilotQueryFallback({
    title: `${scopeLabel(context) ?? 'Copilot'} · limited response`,
    message: COPILOT_SIGN_IN_MESSAGE,
    suggestions: buildContextualSuggestions(context),
  }, context);
}

function normalizeCopilotQueryPayload(
  rawPayload: unknown,
  context: CopilotFallbackContext | null = null,
): CopilotQueryResponsePayload | null {
  if (!isRecord(rawPayload)) {
    return null;
  }

  if (rawPayload.status === 'ok' || rawPayload.status === 'limited') {
    return rawPayload as unknown as CopilotQueryResponsePayload;
  }

  const legacyMessage = asText(rawPayload.message);
  const legacyType = asText(rawPayload.type);
  if (legacyType === 'system_response' || legacyMessage) {
    return buildCopilotQueryFallback({
      title: `${scopeLabel(context) ?? 'Copilot'} · limited response`,
      message: buildContextualMessage(context, legacyMessage ?? COPILOT_FALLBACK_MESSAGE),
      suggestions: normalizeSuggestions(rawPayload.suggestions).length > 0
        ? normalizeSuggestions(rawPayload.suggestions)
        : buildContextualSuggestions(context),
    }, context);
  }

  return null;
}

export function buildCopilotAskFallback(): CopilotAskResponsePayload {
  const fallback = buildCopilotQueryFallback();
  return {
    answer: `${fallback.title}. ${fallback.message}`,
    intent: 'LIMITED',
    confidence: 0,
    suggestions: [...fallback.suggestions],
    sources: [],
    timing: 0,
    data: {
      status: 'limited',
      results: fallback.results,
      graphInsights: fallback.graphInsights,
      document: fallback.document,
    },
  };
}

export function formatCopilotAskResponse(
  payload: CopilotQueryResponsePayload,
  durationMs: number,
): CopilotAskResponsePayload {
  const results = payload.results ?? [];
  const graphInsights = payload.graphInsights ?? [];

  if (payload.status === 'limited') {
    return {
      answer: payload.answer || `${payload.title}. ${payload.message}`.trim(),
      intent: 'LIMITED',
      confidence: Math.max(0, Math.min(1, payload.confidence ?? 0)),
      suggestions: payload.suggestions.length > 0
        ? [...payload.suggestions]
        : [...COPILOT_FALLBACK_SUGGESTIONS],
      sources: payload.sources.length > 0 ? [...payload.sources] : [],
      timing: durationMs,
      data: {
        status: payload.status,
        results,
        graphInsights,
        document: payload.document,
      },
    };
  }

  const explanation = payload.explanations.find((item) => asText(item?.summary))?.summary ?? null;
  const topTitles = results
    .map((result) => asText(result.title))
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  const documentSummary = payload.document.sections.find((section) => section.key === 'summary')?.summary;
  const answer = (
    asText(payload.answer)
    ?? asText(documentSummary)
    ?? asText(explanation)
    ?? (topTitles.length > 0 ? `Top matches: ${topTitles.join('; ')}.` : null)
    ?? (graphInsights.length > 0 ? asText(graphInsights[0]?.summary) : null)
    ?? COPILOT_FALLBACK_MESSAGE
  );
  const sources = (
    payload.sources.length > 0
      ? payload.sources
      : results.flatMap((result) => result.sourceCoverage ?? [])
  )
    .filter((source, index, collection) => collection.indexOf(source) === index)
    .slice(0, 6);
  const confidence = Math.max(0, Math.min(1, payload.confidence ?? 0));

  return {
    answer,
    intent: 'COPILOT_RESPONSE',
    confidence,
    suggestions: payload.document.suggestions.length > 0
      ? [...payload.document.suggestions]
      : [...COPILOT_FALLBACK_SUGGESTIONS],
    sources,
    timing: durationMs,
    data: {
      status: payload.status,
      results,
      graphInsights,
      document: payload.document,
    },
  };
}

export async function queryCopilot(body: string, routePath: string) {
  const request = parseQueryRequest(body);
  const authContext = await resolveIntelligenceAuthContext();

  if (authContext.status !== 'authenticated') {
    logIntelligenceFallbackUsage(routePath, authContext, 'read_fallback');
    return buildAuthLimitedFallback(authContext.status, request.context);
  }

  try {
    const response = await fetch(`${BACKEND}/api/copilot/query`, {
      method: 'POST',
      headers: await buildForwardHeaders({
        'Content-Type': 'application/json',
      }, { context: authContext }),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
      return buildCopilotQueryFallback({
        title: `${scopeLabel(request.context) ?? 'Copilot'} · limited response`,
        message: 'Live Copilot sources are unavailable right now, but the current investigation context is still available locally.',
        suggestions: buildContextualSuggestions(request.context),
      }, request.context);
    }

    const payload = await response.json().catch(() => null);
    const normalizedPayload = normalizeCopilotQueryPayload(payload, request.context);
    if (!normalizedPayload) {
      logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
      return buildCopilotQueryFallback({
        title: `${scopeLabel(request.context) ?? 'Copilot'} · limited response`,
        message: 'Live Copilot sources are unavailable right now, but the current investigation context is still available locally.',
        suggestions: buildContextualSuggestions(request.context),
      }, request.context);
    }

    return normalizedPayload;
  } catch {
    logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
    return buildCopilotQueryFallback({
      title: `${scopeLabel(request.context) ?? 'Copilot'} · limited response`,
      message: 'Live Copilot sources are unavailable right now, but the current investigation context is still available locally.',
      suggestions: buildContextualSuggestions(request.context),
    }, request.context);
  }
}
