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

function buildLimitedDocument(
  title: string,
  message: string,
  suggestions: string[],
  mode: CopilotDocumentMode = 'summary',
): CopilotDocument {
  return {
    mode,
    title,
    generatedAt: new Date().toISOString(),
    suggestions,
    sections: [
      {
        key: 'summary',
        title: 'SUMMARY',
        availability: 'limited',
        summary: message,
        items: [{ id: 'limited-summary', body: message, availability: 'limited' }],
      },
      {
        key: 'evidence',
        title: 'EVIDENCE',
        availability: 'unavailable',
        items: [],
      },
      {
        key: 'signals',
        title: 'SIGNALS',
        availability: 'unavailable',
        items: [],
      },
      {
        key: 'network_context',
        title: 'NETWORK CONTEXT',
        availability: 'unavailable',
        items: [],
      },
      {
        key: 'recommended_action',
        title: 'RECOMMENDED ACTION',
        availability: 'limited',
        items: [
          {
            id: 'limited-recommended-action',
            body: suggestions[0] ?? 'Add more investigation context and retry.',
            availability: 'limited',
          },
        ],
      },
      {
        key: 'follow_up_questions',
        title: 'FOLLOW-UP QUESTIONS',
        availability: suggestions.length > 0 ? 'ready' : 'unavailable',
        items: suggestions.map((suggestion, index) => ({
          id: `limited-follow-up-${index}`,
          body: suggestion,
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
} = {}): CopilotQueryLimitedResponsePayload {
  const title = input.title ?? 'Copilot needs more investigation context';
  const message = input.message ?? COPILOT_FALLBACK_MESSAGE;
  const suggestions = input.suggestions?.length
    ? [...input.suggestions]
    : [...COPILOT_FALLBACK_SUGGESTIONS];

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
    document: buildLimitedDocument(title, message, suggestions, input.mode),
  };
}

function buildAuthLimitedFallback(
  status: Awaited<ReturnType<typeof resolveIntelligenceAuthContext>>['status'],
): CopilotQueryLimitedResponsePayload {
  if (status === 'missing_session') {
    return buildCopilotQueryFallback({
      title: 'Copilot requires authentication',
      message: 'Sign in before running Copilot investigation workflows.',
      suggestions: [
        'Sign in and reopen Copilot',
        'Select an organization workspace',
        'Retry the same request',
      ],
    });
  }

  return buildCopilotQueryFallback({
    title: 'Copilot requires organization context',
    message: 'Switch to an organization workspace before running Copilot investigation workflows.',
    suggestions: [
      'Switch to an organization workspace',
      'Open the investigation workbench',
      'Retry the same request',
    ],
  });
}

function normalizeCopilotQueryPayload(rawPayload: unknown): CopilotQueryResponsePayload | null {
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
      title: 'Copilot needs more investigation context',
      message: legacyMessage ?? COPILOT_FALLBACK_MESSAGE,
      suggestions: normalizeSuggestions(rawPayload.suggestions).length > 0
        ? normalizeSuggestions(rawPayload.suggestions)
        : [...COPILOT_FALLBACK_SUGGESTIONS],
    });
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
  const authContext = await resolveIntelligenceAuthContext();

  if (authContext.status !== 'authenticated') {
    logIntelligenceFallbackUsage(routePath, authContext, 'read_fallback');
    return buildAuthLimitedFallback(authContext.status);
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
        title: 'Copilot source unavailable',
        message: 'Copilot could not complete this request because one or more live sources were unavailable.',
        suggestions: ['Retry shortly', 'Open investigation workbench', 'Narrow the scope to the current provider'],
      });
    }

    const payload = await response.json().catch(() => null);
    const normalizedPayload = normalizeCopilotQueryPayload(payload);
    if (!normalizedPayload) {
      logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
      return buildCopilotQueryFallback({
        title: 'Copilot source unavailable',
        message: 'Copilot returned an invalid response and could not safely continue.',
        suggestions: ['Retry the request', 'Open investigation workbench', 'Use a narrower prompt'],
      });
    }

    return normalizedPayload;
  } catch {
    logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
    return buildCopilotQueryFallback({
      title: 'Copilot source unavailable',
      message: 'Copilot could not reach live investigation sources in time.',
      suggestions: ['Retry shortly', 'Inspect current findings directly', 'Open the investigation workbench'],
    });
  }
}
