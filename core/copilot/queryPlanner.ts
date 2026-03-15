import type {
  CopilotEntityType,
  CopilotQueryPlan,
  ParsedCopilotQuery,
} from './copilotEngine';

function prioritizeEntityTypes(parsedQuery: ParsedCopilotQuery): CopilotEntityType[] {
  const base: CopilotEntityType[] = ['CLINICIAN', 'ORGANIZATION', 'OPPORTUNITY', 'PROGRAM', 'DOCUMENT'];

  switch (parsedQuery.intent) {
    case 'RESEARCH_DISCOVERY':
      return ['CLINICIAN', 'PROGRAM', 'ORGANIZATION', 'DOCUMENT', 'OPPORTUNITY'];
    case 'GRAPH_EXPLORATION':
      return ['CLINICIAN', 'ORGANIZATION', 'PROGRAM', 'OPPORTUNITY', 'DOCUMENT'];
    case 'DUE_DILIGENCE':
      return ['CLINICIAN', 'ORGANIZATION', 'DOCUMENT', 'OPPORTUNITY', 'PROGRAM'];
    case 'EXPLAINABILITY':
      return ['CLINICIAN', 'ORGANIZATION', 'OPPORTUNITY', 'DOCUMENT', 'PROGRAM'];
    default:
      return base;
  }
}

export function planCopilotQuery(
  parsedQuery: ParsedCopilotQuery,
  limit: number,
): CopilotQueryPlan {
  const normalizedLimit = Math.min(Math.max(limit, 1), 50);
  const hasStructuredFilters =
    parsedQuery.structuredFilters.specialties.length > 0 ||
    parsedQuery.structuredFilters.states.length > 0 ||
    parsedQuery.structuredFilters.institutions.length > 0 ||
    parsedQuery.structuredFilters.licenseStatuses.length > 0 ||
    parsedQuery.structuredFilters.boardCertified !== undefined ||
    parsedQuery.structuredFilters.payments !== undefined ||
    parsedQuery.structuredFilters.affiliations.length > 0 ||
    parsedQuery.structuredFilters.trustScore !== undefined;

  const wantsGraph = parsedQuery.graphTraversal.length > 0 || hasStructuredFilters;
  const wantsSemantic = parsedQuery.semanticTopics.length > 0 || parsedQuery.keywords.length > 1;
  const wantsTrust = parsedQuery.structuredFilters.trustScore !== undefined || parsedQuery.intent === 'DUE_DILIGENCE';

  const stageOrder = ['STRUCTURED'] as CopilotQueryPlan['stageOrder'];
  if (wantsSemantic) {
    stageOrder.push('SEMANTIC');
  }
  if (wantsGraph) {
    stageOrder.push('GRAPH');
  }
  if (wantsTrust) {
    stageOrder.push('TRUST');
  }

  return {
    limit: normalizedLimit,
    stageOrder,
    stageBudgets: {
      structured: Math.min(normalizedLimit * 4, 80),
      semantic: wantsSemantic ? Math.min(normalizedLimit * 3, 60) : 0,
      graph: wantsGraph ? Math.min(normalizedLimit * 2, 40) : 0,
      trust: wantsTrust ? Math.min(normalizedLimit * 2, 30) : 0,
    },
    prioritizedTypes: prioritizeEntityTypes(parsedQuery),
    semanticFields: [
      'provider biography',
      'publication abstracts',
      'trial descriptions',
      'claims explanations',
    ],
    graphDepth: parsedQuery.graphTraversal.length > 0 ? 3 : 2,
  };
}
