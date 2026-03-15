import type { QueryIntent } from './queryIntentParser';

export interface QueryHistorySample {
  normalizedQuery: string | null;
  queryTemplate: string;
  createdAt: string;
  resultCount: number | null;
  metadata: Record<string, unknown>;
}

export interface QuerySuggestionFeedback {
  suggestionKey: string;
  accepted: boolean;
  createdAt: string;
}

export interface PopularQueryPattern {
  template: string;
  count: number;
  lastSeenAt: string;
  exampleQuery: string | null;
}

export interface RankedQuerySuggestion {
  text: string;
  score: number;
  reasons: string[];
  source: 'history' | 'pattern' | 'base';
}

const SOURCE_PRIORITY: Record<RankedQuerySuggestion['source'], number> = {
  history: 3,
  pattern: 2,
  base: 1,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function daysSince(isoDate: string, now: Date): number {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 365;
  }

  return Math.max(0, (now.getTime() - parsed.getTime()) / 86_400_000);
}

function prefixMatchScore(prefix: string, candidate: string): number {
  const normalizedPrefix = normalize(prefix);
  const normalizedCandidate = normalize(candidate);
  if (normalizedCandidate.startsWith(normalizedPrefix)) {
    return 1;
  }

  if (normalizedCandidate.split(/\s+/).some((token) => token.startsWith(normalizedPrefix))) {
    return 0.7;
  }

  if (normalizedCandidate.includes(normalizedPrefix)) {
    return 0.4;
  }

  return 0;
}

export function detectPopularSearchPatterns(
  history: QueryHistorySample[],
  limit = 10,
): PopularQueryPattern[] {
  const grouped = new Map<string, PopularQueryPattern>();

  for (const sample of history) {
    const key = sample.queryTemplate.trim();
    if (key.length === 0) {
      continue;
    }

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        template: key,
        count: 1,
        lastSeenAt: sample.createdAt,
        exampleQuery: sample.normalizedQuery,
      });
      continue;
    }

    existing.count += 1;
    if (new Date(sample.createdAt).getTime() > new Date(existing.lastSeenAt).getTime()) {
      existing.lastSeenAt = sample.createdAt;
      if (sample.normalizedQuery) {
        existing.exampleQuery = sample.normalizedQuery;
      }
    }
  }

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt))
    .slice(0, limit);
}

export function rankQuerySuggestions(input: {
  prefix: string;
  intent: QueryIntent;
  history: QueryHistorySample[];
  baseSuggestions: string[];
  patternSuggestions: string[];
  feedback: QuerySuggestionFeedback[];
  limit?: number;
  now?: Date;
}): RankedQuerySuggestion[] {
  const now = input.now ?? new Date();
  const acceptanceByKey = new Map<string, { accepted: number; rejected: number }>();

  for (const item of input.feedback) {
    const key = normalize(item.suggestionKey);
    const bucket = acceptanceByKey.get(key) ?? { accepted: 0, rejected: 0 };
    if (item.accepted) {
      bucket.accepted += 1;
    } else {
      bucket.rejected += 1;
    }
    acceptanceByKey.set(key, bucket);
  }

  const historyCounts = new Map<string, number>();
  const historyRecency = new Map<string, string>();
  for (const sample of input.history) {
    if (!sample.normalizedQuery) {
      continue;
    }

    const key = normalize(sample.normalizedQuery);
    historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1);
    const currentRecency = historyRecency.get(key);
    if (!currentRecency || new Date(sample.createdAt).getTime() > new Date(currentRecency).getTime()) {
      historyRecency.set(key, sample.createdAt);
    }
  }

  const candidates = new Map<string, RankedQuerySuggestion>();
  const register = (text: string, source: RankedQuerySuggestion['source'], seedReasons: string[]): void => {
    const normalized = normalize(text);
    if (normalized.length === 0) {
      return;
    }

    const prefixScore = prefixMatchScore(input.prefix, normalized);
    if (prefixScore === 0) {
      return;
    }

    const count = historyCounts.get(normalized) ?? 0;
    const popularityScore = Math.min(1, count / 5);
    const lastSeenAt = historyRecency.get(normalized);
    const recencyScore = lastSeenAt ? Math.max(0, 1 - (daysSince(lastSeenAt, now) / 30)) : 0.4;
    const feedback = acceptanceByKey.get(normalized);
    const acceptanceScore = feedback
      ? feedback.accepted / Math.max(1, feedback.accepted + feedback.rejected)
      : 0.5;
    const intentScore = input.intent.requiresHighTrust && normalized.includes('trust')
      ? 1
      : input.intent.regionTerm && normalized.includes(input.intent.regionTerm)
        ? 1
        : input.intent.organizationTerm && normalized.includes(input.intent.organizationTerm)
          ? 1
          : 0.6;

    const score = Math.round((
      (prefixScore * 0.35)
      + (popularityScore * 0.2)
      + (recencyScore * 0.15)
      + (acceptanceScore * 0.15)
      + (intentScore * 0.15)
    ) * 10_000) / 10_000;

    const reasons = [...seedReasons];
    if (count > 0) {
      reasons.push(`history:${count}`);
    }
    if (feedback) {
      reasons.push(`acceptance:${acceptanceScore.toFixed(2)}`);
    }

    const existing = candidates.get(normalized);
    if (
      !existing
      || existing.score < score
      || (
        existing.score === score
        && SOURCE_PRIORITY[source] > SOURCE_PRIORITY[existing.source]
      )
    ) {
      candidates.set(normalized, {
        text,
        score,
        reasons,
        source,
      });
    }
  };

  for (const suggestion of input.baseSuggestions) {
    register(suggestion, 'base', ['base']);
  }
  for (const suggestion of input.patternSuggestions) {
    register(suggestion, 'pattern', ['pattern']);
  }
  for (const sample of input.history) {
    if (sample.normalizedQuery) {
      register(sample.normalizedQuery, 'history', ['history']);
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
    .slice(0, input.limit ?? 5);
}
