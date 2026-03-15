/**
 * queryPredictionService.ts — Query prediction stubs
 *
 * Lightweight stubs for search query tracking and prediction.
 * Accepts flexible parameter shapes from route handlers.
 */

import { log } from '../../obs/logger';

// Accept flexible params from various callers
export type QueryHistoryEntry = Record<string, unknown>;
export type PredictionRequest = Record<string, unknown>;

export interface PredictionResult {
  suggestions: string[];
  source: 'history' | 'static';
}

// In-memory recent queries (ring buffer)
const recentQueries: string[] = [];
const MAX_RECENT = 200;

export async function recordQueryHistory(entry: QueryHistoryEntry): Promise<void> {
  const query = String(entry.query ?? entry.q ?? '').toLowerCase().trim();
  if (query) {
    recentQueries.push(query);
    if (recentQueries.length > MAX_RECENT) recentQueries.shift();
  }
  log('debug', `[QueryPrediction] Recorded query: "${query}"`);
}

export async function predictSearchSuggestions(
  request: PredictionRequest,
): Promise<PredictionResult> {
  const prefix = String(request.prefix ?? request.query ?? request.q ?? '').toLowerCase().trim();
  const limit = Number(request.limit ?? 5);

  if (prefix.length < 2) {
    return { suggestions: [], source: 'static' };
  }

  const matches = [...new Set(recentQueries)]
    .filter(q => q.startsWith(prefix) && q !== prefix)
    .slice(0, limit);

  return { suggestions: matches, source: matches.length > 0 ? 'history' : 'static' };
}

export async function recordQuerySuggestionFeedback(
  _params: Record<string, unknown>,
): Promise<void> {
  // Stub — no-op until query volume justifies persistence
}
