import { parseQueryIntent, type QueryIntent } from './queryIntentParser';
import {
  detectPopularSearchPatterns,
  rankQuerySuggestions,
  type PopularQueryPattern,
  type QueryHistorySample,
  type QuerySuggestionFeedback,
  type RankedQuerySuggestion,
} from './queryLearningModel';

export interface QueryPredictionInput {
  query: string;
  history: QueryHistorySample[];
  feedback: QuerySuggestionFeedback[];
  baseSuggestions?: string[];
  limit?: number;
  now?: Date;
}

export interface QueryPredictionResult {
  query: string;
  intent: QueryIntent;
  popularPatterns: PopularQueryPattern[];
  rankedSuggestions: RankedQuerySuggestion[];
  suggestions: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function topValues(history: QueryHistorySample[], field: 'regionTerm' | 'organizationTerm', limit: number): string[] {
  const counts = new Map<string, number>();

  for (const sample of history) {
    const value = sample.metadata[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function buildPatternSuggestions(intent: QueryIntent, history: QueryHistorySample[]): string[] {
  const suggestions = new Set<string>();
  const normalizedEntity = intent.entityTerm ? normalize(intent.entityTerm) : null;
  const matchingHistory = history.filter((sample) => (
    sample.normalizedQuery
    && normalizedEntity
    && sample.normalizedQuery.startsWith(normalizedEntity)
  ));

  for (const sample of matchingHistory.slice(0, 10)) {
    if (sample.normalizedQuery) {
      suggestions.add(sample.normalizedQuery);
    }
  }

  if (!intent.entityTerm) {
    return [...suggestions];
  }

  const regions = topValues(matchingHistory.length > 0 ? matchingHistory : history, 'regionTerm', 2);
  const organizations = topValues(matchingHistory.length > 0 ? matchingHistory : history, 'organizationTerm', 2);

  for (const region of regions) {
    suggestions.add(`${intent.entityTerm} in ${region}`);
  }

  if (intent.requiresHighTrust || history.some((sample) => sample.queryTemplate.includes('HIGH_TRUST'))) {
    suggestions.add(`${intent.entityTerm} with high trust score`);
  }

  for (const organization of organizations) {
    suggestions.add(`${intent.entityTerm} at ${organization}`);
  }

  return [...suggestions];
}

export function predictQuerySuggestions(input: QueryPredictionInput): QueryPredictionResult {
  const intent = parseQueryIntent(input.query);
  const popularPatterns = detectPopularSearchPatterns(input.history);
  const patternSuggestions = buildPatternSuggestions(intent, input.history);
  const rankedSuggestions = rankQuerySuggestions({
    prefix: input.query,
    intent,
    history: input.history,
    baseSuggestions: input.baseSuggestions ?? [],
    patternSuggestions,
    feedback: input.feedback,
    limit: input.limit ?? 5,
    now: input.now,
  });

  return {
    query: input.query,
    intent,
    popularPatterns,
    rankedSuggestions,
    suggestions: rankedSuggestions.map((entry) => entry.text),
  };
}
