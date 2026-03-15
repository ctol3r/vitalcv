import type { GraphNode, GraphQueryResult } from './schema';
import type {
  NetworkEdge,
  NetworkEdgeEvidenceCounts,
  NetworkMap,
  NetworkNode,
  TraversalResult,
} from '../../../../../../core/investigation/investigationEngine';

export interface ProviderRelationshipPublication {
  publicationId: string;
  title: string;
  citationCount: number;
  coAuthors: string[];
  publishedDate: string | null;
}

export interface ProviderRelationshipTrial {
  trialId: string;
  title: string;
  role: string;
  status: string;
  startDate: string | null;
}

export interface ProviderRelationshipPayment {
  paymentYear: number;
  totalAmount: number;
  recordCount: number;
  topPayers: string[];
}

export interface ProviderRelationshipSnapshot {
  npi: string;
  providerName: string;
  primarySpecialty: string | null;
  secondarySpecialties: string[];
  affiliations: string[];
  institutions: string[];
  publications: ProviderRelationshipPublication[];
  trials: ProviderRelationshipTrial[];
  payments: ProviderRelationshipPayment[];
  grants: string[];
  metadata: Record<string, unknown>;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function providerNodeId(npi: string): string {
  return `provider:${npi}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function countShared(left: string[], right: string[]): number {
  const rightSet = new Set(right.map(normalizeKey));
  return left.filter((value) => rightSet.has(normalizeKey(value))).length;
}

function buildProviderNode(snapshot: ProviderRelationshipSnapshot): NetworkNode {
  return {
    id: providerNodeId(snapshot.npi),
    label: snapshot.providerName,
    entityType: 'PROVIDER',
    npi: snapshot.npi,
    metadata: {
      npi: snapshot.npi,
      primarySpecialty: snapshot.primarySpecialty,
      secondarySpecialties: [...snapshot.secondarySpecialties],
      affiliations: [...snapshot.affiliations],
      institutions: [...snapshot.institutions],
      ...snapshot.metadata,
    },
  };
}

function evidenceCounts(
  left: ProviderRelationshipSnapshot,
  right: ProviderRelationshipSnapshot,
): NetworkEdgeEvidenceCounts {
  const leftPublicationIds = uniqueStrings(left.publications.map((publication) => publication.publicationId));
  const rightPublicationIds = uniqueStrings(right.publications.map((publication) => publication.publicationId));
  const leftTrialIds = uniqueStrings(left.trials.map((trial) => trial.trialId));
  const rightTrialIds = uniqueStrings(right.trials.map((trial) => trial.trialId));
  const leftPayers = uniqueStrings(left.payments.flatMap((payment) => payment.topPayers));
  const rightPayers = uniqueStrings(right.payments.flatMap((payment) => payment.topPayers));

  return {
    coPublicationCount: countShared(leftPublicationIds, rightPublicationIds),
    sharedGrants: countShared(left.grants, right.grants),
    sharedTrials: countShared(leftTrialIds, rightTrialIds),
    sharedPayments: countShared(leftPayers, rightPayers),
    sharedInstitutions: countShared(left.institutions, right.institutions),
  };
}

function edgeWeight(
  counts: NetworkEdgeEvidenceCounts,
  includeInstitutionFallback: boolean,
): number {
  const weighted =
    counts.coPublicationCount +
    counts.sharedGrants +
    counts.sharedTrials +
    counts.sharedPayments;

  if (weighted > 0) {
    return weighted;
  }

  if (includeInstitutionFallback && counts.sharedInstitutions > 0) {
    return counts.sharedInstitutions;
  }

  return 0;
}

function evidenceLines(counts: NetworkEdgeEvidenceCounts): string[] {
  const lines: string[] = [];
  if (counts.coPublicationCount > 0) {
    lines.push(`shared_publications:${counts.coPublicationCount}`);
  }
  if (counts.sharedGrants > 0) {
    lines.push(`shared_grants:${counts.sharedGrants}`);
  }
  if (counts.sharedTrials > 0) {
    lines.push(`shared_trials:${counts.sharedTrials}`);
  }
  if (counts.sharedPayments > 0) {
    lines.push(`shared_payments:${counts.sharedPayments}`);
  }
  if (counts.sharedInstitutions > 0) {
    lines.push(`shared_institutions:${counts.sharedInstitutions}`);
  }
  return lines;
}

function countsForTraversal(
  counts: NetworkEdgeEvidenceCounts,
  traversal: TraversalResult['traversal'],
): NetworkEdgeEvidenceCounts {
  if (traversal === 'coAuthorNetwork') {
    return {
      coPublicationCount: counts.coPublicationCount,
      sharedGrants: 0,
      sharedTrials: 0,
      sharedPayments: 0,
      sharedInstitutions: 0,
    };
  }

  if (traversal === 'trialInvestigatorNetwork') {
    return {
      coPublicationCount: 0,
      sharedGrants: 0,
      sharedTrials: counts.sharedTrials,
      sharedPayments: 0,
      sharedInstitutions: 0,
    };
  }

  if (traversal === 'institutionNetwork') {
    return {
      coPublicationCount: 0,
      sharedGrants: 0,
      sharedTrials: 0,
      sharedPayments: 0,
      sharedInstitutions: counts.sharedInstitutions,
    };
  }

  return {
    coPublicationCount: 0,
    sharedGrants: counts.sharedGrants,
    sharedTrials: 0,
    sharedPayments: counts.sharedPayments,
    sharedInstitutions: 0,
  };
}

function pairKey(source: string, target: string): string {
  return [source, target].sort().join('::');
}

function graphEntityType(node: GraphNode): NetworkNode['entityType'] | null {
  if (node.type === 'institution') {
    return 'INSTITUTION';
  }
  if (node.type === 'organization') {
    return 'ORGANIZATION';
  }
  if (node.type === 'source') {
    return 'SOURCE';
  }
  if (node.type === 'artifact' || node.type === 'license' || node.type === 'decision') {
    return 'ARTIFACT';
  }
  return null;
}

function mapGraphNode(
  node: GraphNode,
  providerByNpi: Map<string, ProviderRelationshipSnapshot>,
): NetworkNode | null {
  if (node.type === 'clinician') {
    const npi = typeof node.metadata.npi === 'string' ? node.metadata.npi : undefined;
    if (!npi) {
      return null;
    }

    const snapshot = providerByNpi.get(npi);
    return snapshot ? buildProviderNode(snapshot) : null;
  }

  const entityType = graphEntityType(node);
  if (!entityType) {
    return null;
  }

  return {
    id: node.id,
    label: node.label,
    entityType,
    metadata: { ...node.metadata },
  };
}

function mapGraphNodeId(
  node: GraphNode | undefined,
  providerByNpi: Map<string, ProviderRelationshipSnapshot>,
): string | null {
  if (!node) {
    return null;
  }

  if (node.type === 'clinician') {
    const npi = typeof node.metadata.npi === 'string' ? node.metadata.npi : undefined;
    if (!npi || !providerByNpi.has(npi)) {
      return null;
    }

    return providerNodeId(npi);
  }

  return graphEntityType(node) ? node.id : null;
}

function emptyTraversal(
  traversal: TraversalResult['traversal'],
): TraversalResult {
  return {
    traversal,
    nodes: [],
    edges: [],
  };
}

function buildTraversal(
  traversal: TraversalResult['traversal'],
  providers: ProviderRelationshipSnapshot[],
): TraversalResult {
  const relevantNodes = new Map<string, NetworkNode>();
  const relevantEdges: NetworkEdge[] = [];

  for (let index = 0; index < providers.length; index += 1) {
    for (let inner = index + 1; inner < providers.length; inner += 1) {
      const left = providers[index]!;
      const right = providers[inner]!;
      const counts = evidenceCounts(left, right);
      const predicate =
        traversal === 'coAuthorNetwork'
          ? counts.coPublicationCount > 0
          : traversal === 'trialInvestigatorNetwork'
            ? counts.sharedTrials > 0
            : traversal === 'institutionNetwork'
              ? counts.sharedInstitutions > 0
              : counts.sharedPayments > 0 || counts.sharedGrants > 0;

      if (!predicate) {
        continue;
      }

      const source = buildProviderNode(left);
      const target = buildProviderNode(right);
      relevantNodes.set(source.id, source);
      relevantNodes.set(target.id, target);
      const traversalCounts = countsForTraversal(counts, traversal);

      const relationshipType =
        traversal === 'coAuthorNetwork'
          ? 'CO_AUTHOR'
          : traversal === 'trialInvestigatorNetwork'
            ? 'TRIAL_INVESTIGATOR'
            : traversal === 'institutionNetwork'
              ? 'INSTITUTION'
              : 'INDUSTRY_FUNDING';

      relevantEdges.push({
        source: source.id,
        target: target.id,
        relationshipTypes: [relationshipType],
        edgeWeight: edgeWeight(traversalCounts, traversal === 'institutionNetwork'),
        evidenceCounts: traversalCounts,
        evidence: evidenceLines(traversalCounts),
        metadata: {
          sourceNpi: left.npi,
          targetNpi: right.npi,
        },
      });
    }
  }

  return {
    traversal,
    nodes: [...relevantNodes.values()],
    edges: relevantEdges,
  };
}

function mergeEdges(edges: NetworkEdge[]): NetworkEdge[] {
  const merged = new Map<string, NetworkEdge>();

  for (const edge of edges) {
    const key = edge.relationshipTypes.includes('GRAPH_RELATIONSHIP')
      ? `${edge.source}->${edge.target}:${edge.relationshipTypes.join('|')}`
      : pairKey(edge.source, edge.target);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...edge,
        evidence: uniqueStrings(edge.evidence),
        relationshipTypes: [...edge.relationshipTypes],
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      relationshipTypes: uniqueStrings([
        ...existing.relationshipTypes,
        ...edge.relationshipTypes,
      ]) as NetworkEdge['relationshipTypes'],
      edgeWeight: round(existing.edgeWeight + edge.edgeWeight),
      evidenceCounts: {
        coPublicationCount: existing.evidenceCounts.coPublicationCount + edge.evidenceCounts.coPublicationCount,
        sharedGrants: existing.evidenceCounts.sharedGrants + edge.evidenceCounts.sharedGrants,
        sharedTrials: existing.evidenceCounts.sharedTrials + edge.evidenceCounts.sharedTrials,
        sharedPayments: existing.evidenceCounts.sharedPayments + edge.evidenceCounts.sharedPayments,
        sharedInstitutions: existing.evidenceCounts.sharedInstitutions + edge.evidenceCounts.sharedInstitutions,
      },
      evidence: uniqueStrings([...existing.evidence, ...edge.evidence]),
      metadata: {
        ...existing.metadata,
        ...edge.metadata,
      },
    });
  }

  return [...merged.values()].sort(
    (left, right) => right.edgeWeight - left.edgeWeight || left.source.localeCompare(right.source),
  );
}

export function buildNetworkMap(input: {
  npi: string;
  graph: GraphQueryResult;
  providers: ProviderRelationshipSnapshot[];
  generatedAt?: string;
}): NetworkMap {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const providerByNpi = new Map(input.providers.map((provider) => [provider.npi, provider]));
  const nodes = new Map<string, NetworkNode>();

  for (const provider of input.providers) {
    const node = buildProviderNode(provider);
    nodes.set(node.id, node);
  }

  const graphNodeById = new Map(input.graph.chunk.nodes.map((node) => [node.id, node]));
  for (const graphNode of input.graph.chunk.nodes) {
    const mapped = mapGraphNode(graphNode, providerByNpi);
    if (mapped) {
      nodes.set(mapped.id, mapped);
    }
  }

  const coAuthorNetwork = buildTraversal('coAuthorNetwork', input.providers);
  const trialInvestigatorNetwork = buildTraversal('trialInvestigatorNetwork', input.providers);
  const institutionNetwork = buildTraversal('institutionNetwork', input.providers);
  const industryFundingNetwork = buildTraversal('industryFundingNetwork', input.providers);

  const graphEdges = input.graph.chunk.edges.flatMap((edge): NetworkEdge[] => {
    const sourceNodeId = mapGraphNodeId(graphNodeById.get(edge.source), providerByNpi);
    const targetNodeId = mapGraphNodeId(graphNodeById.get(edge.target), providerByNpi);
    if (!sourceNodeId || !targetNodeId) {
      return [];
    }

    return [{
      source: sourceNodeId,
      target: targetNodeId,
      relationshipTypes: ['GRAPH_RELATIONSHIP'],
      edgeWeight: round(edge.confidence ?? edge.weight ?? 0.5),
      evidenceCounts: {
        coPublicationCount: 0,
        sharedGrants: 0,
        sharedTrials: 0,
        sharedPayments: 0,
        sharedInstitutions: 0,
      },
      evidence: [`graph:${edge.type}`],
      metadata: {
        graphEdgeId: edge.id,
        graphEdgeType: edge.type,
        directed: edge.directed,
      },
    }];
  });

  const mergedEdges = mergeEdges([
    ...coAuthorNetwork.edges,
    ...trialInvestigatorNetwork.edges,
    ...institutionNetwork.edges,
    ...industryFundingNetwork.edges,
    ...graphEdges,
  ]);

  if (mergedEdges.length === 0) {
    return {
      npi: input.npi,
      generatedAt,
      nodes: [...nodes.values()],
      edges: [],
      traversals: {
        coAuthorNetwork: coAuthorNetwork.edges.length > 0 ? coAuthorNetwork : emptyTraversal('coAuthorNetwork'),
        trialInvestigatorNetwork:
          trialInvestigatorNetwork.edges.length > 0
            ? trialInvestigatorNetwork
            : emptyTraversal('trialInvestigatorNetwork'),
        institutionNetwork:
          institutionNetwork.edges.length > 0
            ? institutionNetwork
            : emptyTraversal('institutionNetwork'),
        industryFundingNetwork:
          industryFundingNetwork.edges.length > 0
            ? industryFundingNetwork
            : emptyTraversal('industryFundingNetwork'),
      },
      stats: {
        nodeCount: nodes.size,
        edgeCount: 0,
        maxEdgeWeight: 0,
      },
    };
  }

  return {
    npi: input.npi,
    generatedAt,
    nodes: [...nodes.values()],
    edges: mergedEdges,
    traversals: {
      coAuthorNetwork,
      trialInvestigatorNetwork,
      institutionNetwork,
      industryFundingNetwork,
    },
    stats: {
      nodeCount: nodes.size,
      edgeCount: mergedEdges.length,
      maxEdgeWeight: Math.max(...mergedEdges.map((edge) => edge.edgeWeight)),
    },
  };
}
