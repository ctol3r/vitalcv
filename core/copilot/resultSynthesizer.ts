import { generateCopilotExplanation } from './explanationGenerator';
import type {
  CopilotCandidate,
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotMatch,
  CopilotQueryPlan,
  CopilotQueryResponse,
  CopilotRankingWeights,
  CopilotResult,
  ParsedCopilotQuery,
  RankedCopilotResult,
} from './copilotEngine';

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizedTrustScore(candidate: CopilotCandidate): number {
  if (candidate.trustScore === undefined) {
    return 0;
  }

  return clampScore(candidate.trustScore / 100);
}

function normalizedFreshnessScore(candidate: CopilotCandidate): number {
  return clampScore(candidate.freshness?.score ?? 0);
}

function normalizedCoverageScore(candidate: CopilotCandidate): number {
  if (candidate.sourceCoverage.length === 0) {
    return 0;
  }

  return clampScore(candidate.sourceCoverage.length / 5);
}

function normalizedRelevanceScore(candidate: CopilotCandidate): number {
  const maxEngineScore = candidate.engineHits.reduce(
    (max, hit) => Math.max(max, hit.score),
    0,
  );
  const filterBonus = Math.min(candidate.matches.length * 0.08, 0.24);
  return clampScore(maxEngineScore + filterBonus);
}

function scoreCandidate(
  candidate: CopilotCandidate,
  rankingWeights: CopilotRankingWeights,
): RankedCopilotResult {
  const relevance = normalizedRelevanceScore(candidate);
  const trustScore = normalizedTrustScore(candidate);
  const freshness = normalizedFreshnessScore(candidate);
  const sourceCoverage = normalizedCoverageScore(candidate);

  return {
    ...candidate,
    scores: {
      relevance,
      trustScore,
      freshness,
      sourceCoverage,
      total: clampScore(
        relevance * rankingWeights.relevance +
          trustScore * rankingWeights.trustScore +
          freshness * rankingWeights.freshness +
          sourceCoverage * rankingWeights.sourceCoverage,
      ),
    },
  };
}

function passesTrustFilter(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const range = parsedQuery.structuredFilters.trustScore;
  if (!range || candidate.trustScore === undefined) {
    return true;
  }

  if (range.min !== undefined && candidate.trustScore < range.min) {
    return false;
  }

  if (range.max !== undefined && candidate.trustScore > range.max) {
    return false;
  }

  return true;
}

function passesBoardCertificationFilter(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  if (parsedQuery.structuredFilters.boardCertified === undefined) {
    return true;
  }

  if (candidate.boardCertified === undefined) {
    return parsedQuery.structuredFilters.boardCertified === false;
  }

  return candidate.boardCertified === parsedQuery.structuredFilters.boardCertified;
}

function passesLicenseStatusFilter(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const statuses = parsedQuery.structuredFilters.licenseStatuses;
  if (statuses.length === 0 || !candidate.licenseStatus) {
    return true;
  }

  return statuses.includes(candidate.licenseStatus.toUpperCase());
}

function passesPaymentsFilter(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const preference = parsedQuery.structuredFilters.payments;
  if (!preference) {
    return true;
  }

  const hasPayments = candidate.payments?.hasPayments === true;
  const total = candidate.payments?.total ?? 0;

  if (preference === 'HAS_PAYMENTS') {
    return hasPayments;
  }

  if (preference === 'NO_PAYMENTS') {
    return !hasPayments;
  }

  return total <= 10_000;
}

function passesResearchTopicsFilter(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  const topics = parsedQuery.structuredFilters.researchTopics;
  if (topics.length === 0) {
    return true;
  }

  const loweredCandidateTopics = candidate.researchTopics.map((topic) => topic.toLowerCase());
  return topics.some((topic) =>
    loweredCandidateTopics.some((candidateTopic) => candidateTopic.includes(topic.toLowerCase())),
  );
}

function passesCandidateFilters(candidate: CopilotCandidate, parsedQuery: ParsedCopilotQuery): boolean {
  return (
    passesTrustFilter(candidate, parsedQuery) &&
    passesBoardCertificationFilter(candidate, parsedQuery) &&
    passesLicenseStatusFilter(candidate, parsedQuery) &&
    passesPaymentsFilter(candidate, parsedQuery) &&
    passesResearchTopicsFilter(candidate, parsedQuery)
  );
}

function toResult(result: RankedCopilotResult, rank: number): CopilotResult {
  return {
    id: result.id,
    rank,
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
  };
}

export function synthesizeCopilotResponse(params: {
  parsedQuery: ParsedCopilotQuery;
  plan: CopilotQueryPlan;
  candidates: CopilotCandidate[];
  graphInsights: CopilotGraphInsight[];
}): CopilotQueryResponse {
  const ranked = params.candidates
    .filter((candidate) => passesCandidateFilters(candidate, params.parsedQuery))
    .map((candidate) => scoreCandidate(candidate, params.parsedQuery.rankingWeights))
    .sort((left, right) => {
      if (right.scores.total !== left.scores.total) {
        return right.scores.total - left.scores.total;
      }

      if ((right.trustScore ?? -1) !== (left.trustScore ?? -1)) {
        return (right.trustScore ?? -1) - (left.trustScore ?? -1);
      }

      return (right.freshness?.observedAt ?? '').localeCompare(left.freshness?.observedAt ?? '');
    })
    .slice(0, params.plan.limit);

  const results = ranked.map((result, index) => toResult(result, index + 1));
  const explanations: CopilotExplanation[] = ranked.map((result) => generateCopilotExplanation(result));
  const topResultIds = new Set(results.map((result) => result.id));
  const graphInsights = params.graphInsights.filter((insight) => !insight.resultId || topResultIds.has(insight.resultId));

  return {
    parsedQuery: params.parsedQuery,
    results,
    explanations,
    graphInsights,
  };
}
