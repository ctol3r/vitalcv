import { interpretCopilotQuery } from './queryInterpreter';
import { planCopilotQuery } from './queryPlanner';
import { synthesizeCopilotResponse } from './resultSynthesizer';

export type CopilotIntent =
  | 'DISCOVERY'
  | 'EXPLAINABILITY'
  | 'GRAPH_EXPLORATION'
  | 'RESEARCH_DISCOVERY'
  | 'DUE_DILIGENCE'
  | 'GENERAL';

export type CopilotGraphTraversal =
  | 'NEIGHBORS'
  | 'COLLABORATORS'
  | 'INSTITUTION_CONNECTIONS'
  | 'TRIAL_INVESTIGATORS'
  | 'PUBLICATION_NETWORKS';

export type CopilotSearchEngine = 'STRUCTURED' | 'SEMANTIC' | 'GRAPH' | 'TRUST';

export type CopilotEntityType =
  | 'CLINICIAN'
  | 'ORGANIZATION'
  | 'OPPORTUNITY'
  | 'PROGRAM'
  | 'DOCUMENT';

export interface CopilotRankingWeights {
  relevance: number;
  trustScore: number;
  freshness: number;
  sourceCoverage: number;
}

export interface CopilotStructuredFilters {
  specialties: string[];
  states: string[];
  institutions: string[];
  licenseStatuses: string[];
  trustScore?: {
    min?: number;
    max?: number;
  };
  boardCertified?: boolean;
  researchTopics: string[];
  payments?: 'HAS_PAYMENTS' | 'LOW_PAYMENTS' | 'NO_PAYMENTS';
  affiliations: string[];
}

export interface ParsedCopilotQuery {
  rawQuery: string;
  normalizedQuery: string;
  intent: CopilotIntent;
  keywords: string[];
  structuredFilters: CopilotStructuredFilters;
  semanticTopics: string[];
  graphTraversal: CopilotGraphTraversal[];
  rankingWeights: CopilotRankingWeights;
}

export interface CopilotQueryPlan {
  limit: number;
  stageOrder: CopilotSearchEngine[];
  stageBudgets: Record<CopilotSearchEngine, number>;
  prioritizedTypes: CopilotEntityType[];
  semanticFields: string[];
  graphDepth: number;
}

export interface CopilotEvidence {
  source: string;
  sourceType: 'GOLD' | 'SILVER' | 'BRONZE' | 'INTERNAL';
  summary: string;
  verifiedAt?: string;
  url?: string;
}

export interface CopilotMatch {
  field:
    | 'specialty'
    | 'state'
    | 'institution'
    | 'licenseStatus'
    | 'trustScore'
    | 'boardCertification'
    | 'researchTopic'
    | 'payments'
    | 'affiliation'
    | 'keyword'
    | 'graph';
  value: string | number | boolean;
  reason: string;
}

export interface CopilotEngineHit {
  engine: CopilotSearchEngine;
  score: number;
  reasons: string[];
}

export interface CopilotCandidate {
  id: string;
  type: CopilotEntityType;
  title: string;
  subtitle?: string;
  summary: string;
  specialty?: string;
  state?: string;
  institution?: string;
  licenseStatus?: string;
  boardCertified?: boolean;
  trustScore?: number;
  trustBand?: string;
  researchTopics: string[];
  affiliations: string[];
  payments?: {
    total?: number;
    hasPayments: boolean;
  };
  freshness?: {
    observedAt?: string;
    score: number;
  };
  sourceCoverage: string[];
  evidence: CopilotEvidence[];
  engineHits: CopilotEngineHit[];
  matches: CopilotMatch[];
  graphSignals: string[];
  metadata: Record<string, string | number | boolean | string[] | undefined>;
}

export interface CopilotTrustEnrichment {
  id: string;
  trustScore?: number;
  trustBand?: string;
  verifiedSources?: string[];
  trustReasons?: string[];
}

export interface CopilotResultScores {
  relevance: number;
  trustScore: number;
  freshness: number;
  sourceCoverage: number;
  total: number;
}

export interface CopilotResult {
  id: string;
  rank: number;
  type: CopilotEntityType;
  title: string;
  subtitle?: string;
  summary: string;
  specialty?: string;
  state?: string;
  institution?: string;
  licenseStatus?: string;
  boardCertified?: boolean;
  trustScore?: number;
  trustBand?: string;
  scores: CopilotResultScores;
  sourceCoverage: string[];
}

export interface RankedCopilotResult extends CopilotCandidate {
  scores: CopilotResultScores;
}

export interface CopilotExplanation {
  resultId: string;
  title: string;
  summary: string;
  because: string[];
  matchedFilters: CopilotMatch[];
  verifiedSources: string[];
  scoring: CopilotResultScores;
}

export interface CopilotGraphInsight {
  resultId?: string;
  type:
    | 'NEIGHBOR'
    | 'COLLABORATOR'
    | 'INSTITUTION_CONNECTION'
    | 'TRIAL_INVESTIGATOR'
    | 'PUBLICATION_NETWORK'
    | 'SOURCE_COVERAGE';
  summary: string;
  path: string[];
  depth: number;
}

export interface CopilotQueryResponse {
  parsedQuery: ParsedCopilotQuery;
  results: CopilotResult[];
  explanations: CopilotExplanation[];
  graphInsights: CopilotGraphInsight[];
}

export interface PreparedCopilotQuery {
  parsedQuery: ParsedCopilotQuery;
  plan: CopilotQueryPlan;
}

export interface CopilotSearchContext {
  parsedQuery: ParsedCopilotQuery;
  plan: CopilotQueryPlan;
}

export interface CopilotTrustContext extends CopilotSearchContext {
  candidates: CopilotCandidate[];
}

export interface CopilotDependencies {
  structuredSearch(context: CopilotSearchContext): Promise<CopilotCandidate[]>;
  semanticSearch(context: CopilotSearchContext): Promise<CopilotCandidate[]>;
  graphSearch(context: CopilotSearchContext): Promise<{
    candidates: CopilotCandidate[];
    insights: CopilotGraphInsight[];
  }>;
  trustSearch(context: CopilotTrustContext): Promise<CopilotTrustEnrichment[]>;
}

function dedupeValues(values: string[]): string[] {
  return [...new Set(values)];
}

function mergeMatches(left: CopilotMatch[], right: CopilotMatch[]): CopilotMatch[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((match) => {
    const key = `${match.field}:${String(match.value)}:${match.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeCandidates(candidates: CopilotCandidate[]): CopilotCandidate[] {
  const merged = new Map<string, CopilotCandidate>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.id);
    if (!existing) {
      merged.set(candidate.id, {
        ...candidate,
        sourceCoverage: dedupeValues(candidate.sourceCoverage),
        affiliations: dedupeValues(candidate.affiliations),
        researchTopics: dedupeValues(candidate.researchTopics),
        graphSignals: dedupeValues(candidate.graphSignals),
      });
      continue;
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
      sourceCoverage: dedupeValues([...existing.sourceCoverage, ...candidate.sourceCoverage]),
      evidence: [...existing.evidence, ...candidate.evidence],
      engineHits: [...existing.engineHits, ...candidate.engineHits],
      matches: mergeMatches(existing.matches, candidate.matches),
      graphSignals: dedupeValues([...existing.graphSignals, ...candidate.graphSignals]),
      affiliations: dedupeValues([...existing.affiliations, ...candidate.affiliations]),
      researchTopics: dedupeValues([...existing.researchTopics, ...candidate.researchTopics]),
      metadata: {
        ...existing.metadata,
        ...candidate.metadata,
      },
    });
  }

  return [...merged.values()];
}

function applyTrustEnrichments(
  candidates: CopilotCandidate[],
  enrichments: CopilotTrustEnrichment[],
): CopilotCandidate[] {
  const byId = new Map(enrichments.map((enrichment) => [enrichment.id, enrichment]));

  return candidates.map((candidate) => {
    const enrichment = byId.get(candidate.id);
    if (!enrichment) {
      return candidate;
    }

    return {
      ...candidate,
      trustScore: enrichment.trustScore ?? candidate.trustScore,
      trustBand: enrichment.trustBand ?? candidate.trustBand,
      sourceCoverage: dedupeValues([
        ...candidate.sourceCoverage,
        ...(enrichment.verifiedSources ?? []),
      ]),
      engineHits: [
        ...candidate.engineHits,
        ...(enrichment.trustScore !== undefined
          ? [{
              engine: 'TRUST' as const,
              score: Math.max(0, Math.min(1, enrichment.trustScore / 100)),
              reasons: enrichment.trustReasons ?? [`trust score = ${enrichment.trustScore}`],
            }]
          : []),
      ],
      matches: [
        ...candidate.matches,
        ...(enrichment.trustScore !== undefined
          ? [{
              field: 'trustScore' as const,
              value: enrichment.trustScore,
              reason: enrichment.trustReasons?.[0] ?? `trust score = ${enrichment.trustScore}`,
            }]
          : []),
      ],
      graphSignals: dedupeValues([
        ...candidate.graphSignals,
        ...(enrichment.trustReasons ?? []),
      ]),
    };
  });
}

export function prepareCopilotQuery(input: {
  query: string;
  limit?: number;
}): PreparedCopilotQuery {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const parsedQuery = interpretCopilotQuery(input.query);
  const plan = planCopilotQuery(parsedQuery, limit);

  return { parsedQuery, plan };
}

export async function executeCopilotPlan(
  preparedQuery: PreparedCopilotQuery,
  dependencies: CopilotDependencies,
): Promise<CopilotQueryResponse> {
  const searchContext: CopilotSearchContext = {
    parsedQuery: preparedQuery.parsedQuery,
    plan: preparedQuery.plan,
  };

  const [structuredCandidates, semanticCandidates, graphResult] = await Promise.all([
    dependencies.structuredSearch(searchContext),
    dependencies.semanticSearch(searchContext),
    dependencies.graphSearch(searchContext),
  ]);

  const mergedCandidates = mergeCandidates([
    ...structuredCandidates,
    ...semanticCandidates,
    ...graphResult.candidates,
  ]);

  const trustEnrichments = await dependencies.trustSearch({
    ...searchContext,
    candidates: mergedCandidates,
  });

  return synthesizeCopilotResponse({
    parsedQuery: preparedQuery.parsedQuery,
    plan: preparedQuery.plan,
    candidates: applyTrustEnrichments(mergedCandidates, trustEnrichments),
    graphInsights: graphResult.insights,
  });
}

export async function runCopilotQuery(
  input: {
    query: string;
    limit?: number;
  },
  dependencies: CopilotDependencies,
): Promise<CopilotQueryResponse> {
  const preparedQuery = prepareCopilotQuery(input);
  return executeCopilotPlan(preparedQuery, dependencies);
}
