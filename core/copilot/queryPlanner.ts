import type {
  CopilotEntityType,
  CopilotQueryPlan,
  CopilotSearchEngine,
  ParsedCopilotQuery,
} from './copilotEngine';

function hasStructuredFilters(parsedQuery: ParsedCopilotQuery): boolean {
  const filters = parsedQuery.structuredFilters;

  return (
    filters.specialties.length > 0 ||
    filters.states.length > 0 ||
    filters.institutions.length > 0 ||
    filters.licenseStatuses.length > 0 ||
    filters.trustScore !== undefined ||
    filters.boardCertified !== undefined ||
    filters.researchTopics.length > 0 ||
    filters.payments !== undefined ||
    filters.affiliations.length > 0
  );
}

function buildStageOrder(parsedQuery: ParsedCopilotQuery): CopilotSearchEngine[] {
  switch (parsedQuery.intent) {
    case 'EXPLAINABILITY':
    case 'DUE_DILIGENCE':
      return ['STRUCTURED', 'TRUST', 'GRAPH', 'SEMANTIC'];
    case 'GRAPH_EXPLORATION':
      return ['GRAPH', 'STRUCTURED', 'TRUST', 'SEMANTIC'];
    case 'RESEARCH_DISCOVERY':
      return ['SEMANTIC', 'GRAPH', 'STRUCTURED', 'TRUST'];
    case 'GENERAL':
      return ['SEMANTIC', 'STRUCTURED', 'GRAPH', 'TRUST'];
    case 'DISCOVERY':
    default:
      return ['STRUCTURED', 'SEMANTIC', 'GRAPH', 'TRUST'];
  }
}

function buildStageBudgets(parsedQuery: ParsedCopilotQuery, limit: number): CopilotQueryPlan['stageBudgets'] {
  const structuredEnabled = hasStructuredFilters(parsedQuery) || parsedQuery.intent !== 'GENERAL';
  const semanticEnabled = parsedQuery.semanticTopics.length > 0;
  const graphEnabled = parsedQuery.graphTraversal.length > 0 || parsedQuery.intent === 'GRAPH_EXPLORATION';
  const trustEnabled =
    parsedQuery.structuredFilters.trustScore !== undefined ||
    parsedQuery.intent === 'DUE_DILIGENCE' ||
    parsedQuery.intent === 'EXPLAINABILITY';

  return {
    structured: structuredEnabled ? Math.max(limit * 4, 24) : Math.max(limit * 2, 12),
    semantic: semanticEnabled ? Math.max(limit * 4, 20) : 0,
    graph: graphEnabled ? Math.max(limit * 3, 15) : Math.max(limit, 8),
    trust: trustEnabled ? Math.max(limit * 2, 12) : Math.max(limit, 8),
  };
}

function buildPrioritizedTypes(parsedQuery: ParsedCopilotQuery): CopilotEntityType[] {
  if (parsedQuery.intent === 'RESEARCH_DISCOVERY') {
    return ['CLINICIAN', 'DOCUMENT', 'PROGRAM', 'ORGANIZATION', 'OPPORTUNITY'];
  }

  if (parsedQuery.intent === 'GRAPH_EXPLORATION') {
    return ['CLINICIAN', 'ORGANIZATION', 'DOCUMENT', 'PROGRAM', 'OPPORTUNITY'];
  }

  if (parsedQuery.structuredFilters.institutions.length > 0 || parsedQuery.structuredFilters.affiliations.length > 0) {
    return ['ORGANIZATION', 'CLINICIAN', 'PROGRAM', 'DOCUMENT', 'OPPORTUNITY'];
  }

  return ['CLINICIAN', 'ORGANIZATION', 'OPPORTUNITY', 'PROGRAM', 'DOCUMENT'];
}

function buildSemanticFields(parsedQuery: ParsedCopilotQuery): string[] {
  const fields = ['title', 'summary', 'researchTopics', 'evidence'];

  if (parsedQuery.intent === 'RESEARCH_DISCOVERY') {
    fields.push('publicationAbstract', 'trialDescription', 'claimsExplanation');
  }

  if (parsedQuery.structuredFilters.specialties.length > 0) {
    fields.push('specialty');
  }

  if (parsedQuery.structuredFilters.institutions.length > 0 || parsedQuery.structuredFilters.affiliations.length > 0) {
    fields.push('institution', 'affiliations');
  }

  return [...new Set(fields)];
}

function buildGraphDepth(parsedQuery: ParsedCopilotQuery): number {
  if (parsedQuery.graphTraversal.includes('PUBLICATION_NETWORKS') || parsedQuery.graphTraversal.includes('TRIAL_INVESTIGATORS')) {
    return 3;
  }

  if (parsedQuery.graphTraversal.length > 0 || parsedQuery.intent === 'GRAPH_EXPLORATION') {
    return 2;
  }

  return 1;
}

export function planCopilotQuery(
  parsedQuery: ParsedCopilotQuery,
  limit = 20,
): CopilotQueryPlan {
  const boundedLimit = Math.min(Math.max(limit, 1), 20);

  return {
    limit: boundedLimit,
    stageOrder: buildStageOrder(parsedQuery),
    stageBudgets: buildStageBudgets(parsedQuery, boundedLimit),
    prioritizedTypes: buildPrioritizedTypes(parsedQuery),
    semanticFields: buildSemanticFields(parsedQuery),
    graphDepth: buildGraphDepth(parsedQuery),
  };
}
