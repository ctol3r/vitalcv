import { generateCopilotExplanation } from './explanationGenerator';
import type {
  CopilotCandidate,
  CopilotGraphInsight,
  CopilotMatch,
  CopilotQueryPlan,
  CopilotQueryResponse,
  ParsedCopilotQuery,
  RankedCopilotResult,
} from './copilotEngine';

type CopilotResponseSynthesizerInput = {
  parsedQuery: ParsedCopilotQuery;
  plan: CopilotQueryPlan;
  candidates: CopilotCandidate[];
  graphInsights: CopilotGraphInsight[];
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function matchStringFilter(candidateValue: string | undefined, filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  if (!candidateValue) {
    return false;
  }

  const lowered = candidateValue.toLowerCase();
  return filters.some((filter) => lowered.includes(filter.toLowerCase()));
}

function matchArrayFilter(candidateValues: string[], filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const loweredValues = candidateValues.map((value) => value.toLowerCase());
  return filters.some((filter) => loweredValues.some((value) => value.includes(filter.toLowerCase())));
}

function matchesTrustScore(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const trustFilter = parsedQuery.structuredFilters.trustScore;
  if (!trustFilter) {
    return true;
  }

  if (candidate.trustScore === undefined) {
    return false;
  }

  if (trustFilter.min !== undefined && candidate.trustScore < trustFilter.min) {
    return false;
  }

  if (trustFilter.max !== undefined && candidate.trustScore > trustFilter.max) {
    return false;
  }

  return true;
}

function matchesPayments(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const paymentsFilter = parsedQuery.structuredFilters.payments;
  if (!paymentsFilter) {
    return true;
  }

  if (paymentsFilter === 'HAS_PAYMENTS') {
    return candidate.payments?.hasPayments === true;
  }

  if (paymentsFilter === 'LOW_PAYMENTS') {
    if (!candidate.payments?.hasPayments || candidate.payments.total === undefined) {
      return false;
    }
    return candidate.payments.total <= 5000;
  }

  if (!candidate.payments) {
    return false;
  }

  return candidate.payments.hasPayments === false || candidate.payments.total === 0;
}

function matchesCandidate(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const filters = parsedQuery.structuredFilters;

  if (!matchStringFilter(candidate.specialty, filters.specialties)) {
    return false;
  }

  if (!matchStringFilter(candidate.state, filters.states)) {
    return false;
  }

  if (!matchStringFilter(candidate.institution, filters.institutions)) {
    return false;
  }

  if (filters.licenseStatuses.length > 0) {
    if (!candidate.licenseStatus) {
      return false;
    }

    const status = candidate.licenseStatus.toUpperCase();
    if (!filters.licenseStatuses.some((filter) => status.includes(filter.toUpperCase()))) {
      return false;
    }
  }

  if (filters.boardCertified !== undefined && candidate.boardCertified !== filters.boardCertified) {
    return false;
  }

  if (!matchArrayFilter(candidate.researchTopics, filters.researchTopics)) {
    return false;
  }

  if (!matchArrayFilter(candidate.affiliations, filters.affiliations)) {
    return false;
  }

  if (!matchesTrustScore(candidate, parsedQuery)) {
    return false;
  }

  if (!matchesPayments(candidate, parsedQuery)) {
    return false;
  }

  return true;
}

function keywordOverlap(parsedQuery: ParsedCopilotQuery, candidate: CopilotCandidate): number {
  if (parsedQuery.keywords.length === 0) {
    return 0.5;
  }

  const haystack = [
    candidate.title,
    candidate.subtitle ?? '',
    candidate.summary,
    candidate.specialty ?? '',
    candidate.state ?? '',
    candidate.institution ?? '',
    candidate.researchTopics.join(' '),
    candidate.affiliations.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const matched = parsedQuery.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  return matched / parsedQuery.keywords.length;
}

function aggregateEngineScore(candidate: CopilotCandidate): number {
  if (candidate.engineHits.length === 0) {
    return 0;
  }

  const byEngine = new Map<string, number>();
  for (const hit of candidate.engineHits) {
    const current = byEngine.get(hit.engine) ?? 0;
    byEngine.set(hit.engine, Math.max(current, clamp01(hit.score)));
  }

  const scores = [...byEngine.values()];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function relevanceScore(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): number {
  const engineScore = aggregateEngineScore(candidate);
  const matchDensity = clamp01(candidate.matches.length / Math.max(parsedQuery.keywords.length, 4));
  const overlap = keywordOverlap(parsedQuery, candidate);

  return clamp01(engineScore * 0.55 + matchDensity * 0.2 + overlap * 0.25);
}

function trustScore(candidate: CopilotCandidate): number {
  return candidate.trustScore === undefined ? 0 : clamp01(candidate.trustScore / 100);
}

function freshnessScore(candidate: CopilotCandidate): number {
  return candidate.freshness?.score ?? 0.15;
}

function sourceCoverageScore(candidate: CopilotCandidate): number {
  return clamp01(candidate.sourceCoverage.length / 4);
}

function priorityIndex(plan: CopilotQueryPlan, candidate: CopilotCandidate): number {
  const index = plan.prioritizedTypes.indexOf(candidate.type);
  return index === -1 ? plan.prioritizedTypes.length : index;
}

function addSourceCoverageInsights(results: RankedCopilotResult[]): CopilotGraphInsight[] {
  return results
    .filter((result) => result.sourceCoverage.length >= 2)
    .slice(0, 3)
    .map((result) => ({
      resultId: result.id,
      type: 'SOURCE_COVERAGE' as const,
      summary: `${result.title} is supported by ${result.sourceCoverage.slice(0, 4).join(', ')}.`,
      path: [result.title, ...result.sourceCoverage.slice(0, 2)],
      depth: 1,
    }));
}

function dedupeGraphInsights(insights: CopilotGraphInsight[]): CopilotGraphInsight[] {
  const seen = new Set<string>();

  return insights.filter((insight) => {
    const key = `${insight.resultId ?? 'global'}:${insight.type}:${insight.summary}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeCandidates(candidates: CopilotCandidate[]): CopilotCandidate[] {
  const merged = new Map<string, CopilotCandidate>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.id);
    if (!existing) {
      merged.set(candidate.id, {
        ...candidate,
        sourceCoverage: dedupeStrings(candidate.sourceCoverage),
        affiliations: dedupeStrings(candidate.affiliations),
        researchTopics: dedupeStrings(candidate.researchTopics),
      });
      continue;
    }

    const matchesByKey = new Map<string, CopilotMatch>();
    for (const match of [...existing.matches, ...candidate.matches]) {
      matchesByKey.set(`${match.field}:${String(match.value)}:${match.reason}`, match);
    }

    merged.set(candidate.id, {
      ...existing,
      title: existing.title.length >= candidate.title.length ? existing.title : candidate.title,
      subtitle: existing.subtitle ?? candidate.subtitle,
      summary: existing.summary.length >= candidate.summary.length ? existing.summary : candidate.summary,
      specialty: existing.specialty ?? candidate.specialty,
      state: existing.state ?? candidate.state,
      institution: existing.institution ?? candidate.institution,
      licenseStatus: existing.licenseStatus ?? candidate.licenseStatus,
      boardCertified: existing.boardCertified ?? candidate.boardCertified,
      trustScore: existing.trustScore ?? candidate.trustScore,
      trustBand: existing.trustBand ?? candidate.trustBand,
      payments: existing.payments ?? candidate.payments,
      freshness:
        (existing.freshness?.score ?? -1) >= (candidate.freshness?.score ?? -1)
          ? existing.freshness
          : candidate.freshness,
      sourceCoverage: dedupeStrings([...existing.sourceCoverage, ...candidate.sourceCoverage]),
      evidence: [...existing.evidence, ...candidate.evidence],
      engineHits: [...existing.engineHits, ...candidate.engineHits],
      matches: [...matchesByKey.values()],
      graphSignals: dedupeStrings([...existing.graphSignals, ...candidate.graphSignals]),
      affiliations: dedupeStrings([...existing.affiliations, ...candidate.affiliations]),
      researchTopics: dedupeStrings([...existing.researchTopics, ...candidate.researchTopics]),
      metadata: {
        ...existing.metadata,
        ...candidate.metadata,
      },
    });
  }

  return [...merged.values()];
}

export function synthesizeCopilotResponse(
  input: CopilotResponseSynthesizerInput,
): CopilotQueryResponse {
  const dedupedCandidates = dedupeCandidates(input.candidates);
  const filteredCandidates = dedupedCandidates.filter((candidate) => matchesCandidate(candidate, input.parsedQuery));
  const effectiveCandidates = filteredCandidates.length > 0 ? filteredCandidates : dedupedCandidates;

  const ranked = effectiveCandidates
    .map((candidate) => {
      const relevance = relevanceScore(candidate, input.parsedQuery);
      const trust = trustScore(candidate);
      const freshness = freshnessScore(candidate);
      const coverage = sourceCoverageScore(candidate);

      const total = clamp01(
        relevance * input.parsedQuery.rankingWeights.relevance +
        trust * input.parsedQuery.rankingWeights.trustScore +
        freshness * input.parsedQuery.rankingWeights.freshness +
        coverage * input.parsedQuery.rankingWeights.sourceCoverage,
      );

      return {
        ...candidate,
        scores: {
          relevance,
          trustScore: trust,
          freshness,
          sourceCoverage: coverage,
          total,
        },
      } satisfies RankedCopilotResult;
    })
    .sort((left, right) => {
      if (right.scores.total !== left.scores.total) {
        return right.scores.total - left.scores.total;
      }

      if (right.scores.relevance !== left.scores.relevance) {
        return right.scores.relevance - left.scores.relevance;
      }

      return priorityIndex(input.plan, left) - priorityIndex(input.plan, right);
    })
    .slice(0, input.plan.limit);

  const results = ranked.map((result, index) => ({
    id: result.id,
    rank: index + 1,
    type: result.type,
    title: result.title,
    subtitle: result.subtitle,
    summary: result.summary,
    specialty: result.specialty,
    state: result.state,
    institution: result.institution,
    licenseStatus: result.licenseStatus,
    boardCertified: result.boardCertified,
    trustScore: result.trustScore,
    trustBand: result.trustBand,
    scores: result.scores,
    sourceCoverage: result.sourceCoverage,
  }));

  const graphInsights = dedupeGraphInsights([
    ...input.graphInsights.filter((insight) => !insight.resultId || ranked.some((result) => result.id === insight.resultId)),
    ...addSourceCoverageInsights(ranked),
  ]).slice(0, Math.max(input.plan.limit, 5));

  return {
    parsedQuery: input.parsedQuery,
    results,
    explanations: ranked.map((result) => generateCopilotExplanation(result)),
    graphInsights,
  };
}
