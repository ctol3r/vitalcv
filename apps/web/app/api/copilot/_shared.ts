import { getApiBase } from '@/lib/api';
import {
  buildForwardHeaders,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../intelligence/_shared';

const BACKEND = getApiBase();

export interface CopilotQueryResult {
  id?: string;
  title?: string;
  summary?: string;
  confidence?: number;
  sourceCoverage?: string[];
}

export interface CopilotGraphInsight {
  summary?: string;
}

export interface CopilotQueryResponsePayload {
  parsedQuery?: unknown;
  results?: CopilotQueryResult[];
  explanations?: Array<{ summary?: string }>;
  graphInsights?: CopilotGraphInsight[];
  type?: string;
  message?: string;
  suggestions?: string[];
}

export interface CopilotAskResponsePayload {
  answer: string;
  intent: string;
  confidence: number;
  suggestions: string[];
  sources: string[];
  timing: number;
  data: {
    results: CopilotQueryResult[];
    graphInsights: CopilotGraphInsight[];
  };
}

export const COPILOT_FALLBACK_MESSAGE = 'Copilot requires active investigation context.';
export const COPILOT_FALLBACK_SUGGESTIONS = [
  'Open an investigation',
  'Review recent findings',
  'Focus the trust graph',
];

export function buildCopilotQueryFallback(): CopilotQueryResponsePayload {
  return {
    type: 'system_response',
    message: COPILOT_FALLBACK_MESSAGE,
    suggestions: [...COPILOT_FALLBACK_SUGGESTIONS],
    results: [],
    explanations: [],
    graphInsights: [],
  };
}

export function buildCopilotAskFallback(): CopilotAskResponsePayload {
  return {
    answer: COPILOT_FALLBACK_MESSAGE,
    intent: 'SYSTEM_RESPONSE',
    confidence: 0,
    suggestions: [...COPILOT_FALLBACK_SUGGESTIONS],
    sources: [],
    timing: 0,
    data: {
      results: [],
      graphInsights: [],
    },
  };
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function formatCopilotAskResponse(
  payload: CopilotQueryResponsePayload,
  durationMs: number,
): CopilotAskResponsePayload {
  const results = payload.results ?? [];
  const graphInsights = payload.graphInsights ?? [];
  const explanation = payload.explanations?.find((item) => asText(item?.summary))?.summary ?? null;
  const topTitles = results
    .map((result) => asText(result.title))
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  const answer = (
    asText(payload.message)
    ?? asText(explanation)
    ?? (topTitles.length > 0 ? `Top matches: ${topTitles.join('; ')}.` : null)
    ?? (graphInsights.length > 0 ? asText(graphInsights[0]?.summary) : null)
    ?? COPILOT_FALLBACK_MESSAGE
  );
  const sources = results
    .flatMap((result) => result.sourceCoverage ?? [])
    .filter((source, index, collection) => collection.indexOf(source) === index)
    .slice(0, 4);
  const confidence = Math.max(
    0,
    Math.min(
      1,
      results.length > 0
        ? (results.reduce((total, result) => total + (result.confidence ?? 0), 0) / results.length)
        : 0,
    ),
  );

  return {
    answer,
    intent: (
      asText(payload.type)?.toUpperCase()
      ?? 'COPILOT_RESPONSE'
    ),
    confidence,
    suggestions: payload.suggestions?.length ? [...payload.suggestions] : [...COPILOT_FALLBACK_SUGGESTIONS],
    sources,
    timing: durationMs,
    data: {
      results,
      graphInsights,
    },
  };
}

export async function queryCopilot(body: string, routePath: string) {
  const authContext = await resolveIntelligenceAuthContext();

  if (authContext.status !== 'authenticated') {
    logIntelligenceFallbackUsage(routePath, authContext, 'read_fallback');
    return buildCopilotQueryFallback();
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
      return buildCopilotQueryFallback();
    }

    const payload = await response.json().catch(() => null) as CopilotQueryResponsePayload | null;
    if (!payload || typeof payload !== 'object') {
      logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
      return buildCopilotQueryFallback();
    }

    return payload;
  } catch {
    logIntelligenceFallbackUsage(routePath, authContext, 'backend_fallback');
    return buildCopilotQueryFallback();
  }
}
