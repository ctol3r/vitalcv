import type { CredentialGraph, GraphEdge, GraphNode } from './types';
import { traverseGraph } from './types';
import { buildCredentialGraphForClinician } from './credentialGraphBuilder';

export type PortabilityConfidence = 'high' | 'medium' | 'low';

export interface StateSource {
  type: 'license' | 'compact';
  label: string;
  nodeId: string;
  expiresAt?: string;
}

export interface PortableOrgSummary {
  orgId: string;
  name: string;
  state?: string;
  ehrType?: string | null;
  privileges: Array<{
    id: string;
    label: string;
    status?: string;
    expiresAt?: string;
  }>;
}

export interface PortablePayerSummary {
  payerId?: string;
  name: string;
  enrollmentStatus?: string;
  planTypes?: string[];
  states?: string[];
}

export interface PortableStateEntry {
  state: string;
  nodeId: string;
  confidence: PortabilityConfidence;
  score: number;
  via: StateSource[];
  organizations: PortableOrgSummary[];
  payers: PortablePayerSummary[];
}

export interface CredentialPortabilitySummary {
  totalStates: number;
  highConfidenceStates: number;
  organizations: number;
  payers: number;
  warnings: number;
}

export interface CredentialPortabilityResponse {
  clinicianId: string;
  generatedAt: string;
  states: PortableStateEntry[];
  summary: CredentialPortabilitySummary;
  graph: CredentialGraph;
  warnings: string[];
}

export interface CredentialPortabilityOptions {
  clinicianId: string;
  includeTimeline?: boolean;
}

export async function getCredentialPortability(
  options: CredentialPortabilityOptions,
): Promise<CredentialPortabilityResponse> {
  const graph = await buildCredentialGraphForClinician({
    clinicianId: options.clinicianId,
    includeTimeline: options.includeTimeline ?? false,
  });

  const clinicianNodeId =
    graph.metadata?.clinicianNodeId ??
    graph.nodes.find((node) => node.type === 'clinician')?.id;

  if (!clinicianNodeId) {
    throw new Error('clinician_node_missing');
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByTarget = buildTargetIndex(graph.edges);

  const traversal = traverseGraph(graph, {
    startNodeId: clinicianNodeId,
    edgeFilter: (edge) =>
      ['holds_license', 'licensed_in', 'member_of_compact', 'compact_extends_to'].includes(edge.type),
  });

  const stateEntries: PortableStateEntry[] = Array.from(traversal.visited)
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is GraphNode => Boolean(node) && node.type === 'state')
    .map((stateNode) => {
      const via = resolveStateSources(stateNode, edgesByTarget, nodesById);
      const organizations = resolveOrganizationsForState(stateNode, edgesByTarget, nodesById);
      const payers = resolvePayersForState(stateNode, edgesByTarget, nodesById, clinicianNodeId, graph.edges);

      const confidence = determineConfidence(via);
      return {
        state: (stateNode.metadata?.code as string) ?? stateNode.label,
        nodeId: stateNode.id,
        confidence,
        score: confidence === 'high' ? 1 : confidence === 'medium' ? 0.75 : 0.4,
        via,
        organizations,
        payers,
      };
    })
    .sort((a, b) => {
      if (a.confidence === b.confidence) {
        return a.state.localeCompare(b.state);
      }
      const order: Record<PortabilityConfidence, number> = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    });

  const summary: CredentialPortabilitySummary = {
    totalStates: stateEntries.length,
    highConfidenceStates: stateEntries.filter((entry) => entry.confidence === 'high').length,
    organizations: stateEntries.reduce((acc, entry) => acc + entry.organizations.length, 0),
    payers: stateEntries.reduce((acc, entry) => acc + entry.payers.length, 0),
    warnings: graph.warnings.length,
  };

  return {
    clinicianId: options.clinicianId,
    generatedAt: graph.metadata.generatedAt,
    states: stateEntries,
    summary,
    graph,
    warnings: graph.warnings,
  };
}

function buildTargetIndex(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const index = new Map<string, GraphEdge[]>();
  edges.forEach((edge) => {
    if (!index.has(edge.target)) {
      index.set(edge.target, []);
    }
    index.get(edge.target)!.push(edge);
  });
  return index;
}

function resolveStateSources(
  stateNode: GraphNode,
  edgesByTarget: Map<string, GraphEdge[]>,
  nodesById: Map<string, GraphNode>,
): StateSource[] {
  const inbound = edgesByTarget.get(stateNode.id) ?? [];
  const entries: StateSource[] = [];

  for (const edge of inbound) {
    if (edge.type === 'licensed_in' && edge.active !== false) {
      const node = nodesById.get(edge.source);
      if (node) {
        entries.push({
          type: 'license',
          label: node.label,
          nodeId: node.id,
          expiresAt: node.metadata?.expiresAt as string | undefined,
        });
      }
    }
    if (edge.type === 'compact_extends_to' && edge.active !== false) {
      const node = nodesById.get(edge.source);
      if (node) {
        entries.push({
          type: 'compact',
          label: node.label,
          nodeId: node.id,
          expiresAt: node.metadata?.expiresAt as string | undefined,
        });
      }
    }
  }

  return entries;
}

function resolveOrganizationsForState(
  stateNode: GraphNode,
  edgesByTarget: Map<string, GraphEdge[]>,
  nodesById: Map<string, GraphNode>,
): PortableOrgSummary[] {
  const inbound = edgesByTarget.get(stateNode.id) ?? [];
  return inbound
    .filter((edge) => edge.type === 'operates_in')
    .map((edge) => nodesById.get(edge.source))
    .filter((node): node is GraphNode => Boolean(node) && node.type === 'org')
    .map((orgNode) => {
      const privilegeEdges = (edgesByTarget.get(orgNode.id) ?? []).filter(
        (edge) => edge.type === 'affiliated_with',
      );
      const privileges = privilegeEdges
        .map((edge) => nodesById.get(edge.source))
        .filter((node): node is GraphNode => Boolean(node))
        .map((node) => ({
          id: node.id,
          label: node.label,
          status: node.status,
          expiresAt: node.metadata?.expiresAt as string | undefined,
        }));

      return {
        orgId: (orgNode.metadata?.orgId as string) ?? orgNode.id,
        name: orgNode.label,
        state: orgNode.metadata?.state as string | undefined,
        ehrType: orgNode.metadata?.ehrType as string | undefined,
        privileges,
      };
    });
}

function resolvePayersForState(
  stateNode: GraphNode,
  edgesByTarget: Map<string, GraphEdge[]>,
  nodesById: Map<string, GraphNode>,
  clinicianNodeId: string,
  allEdges: GraphEdge[],
): PortablePayerSummary[] {
  const inbound = edgesByTarget.get(stateNode.id) ?? [];
  return inbound
    .filter((edge) => edge.type === 'covers_state')
    .map((edge) => nodesById.get(edge.source))
    .filter((node): node is GraphNode => Boolean(node) && node.type === 'payer')
    .map((payerNode) => {
      const enrollmentEdge = allEdges.find(
        (edge) => edge.type === 'enrolled_with' && edge.source === clinicianNodeId && edge.target === payerNode.id,
      );
      return {
        payerId: payerNode.metadata?.payerId as string | undefined,
        name: payerNode.label,
        enrollmentStatus: enrollmentEdge?.metadata?.status as string | undefined,
        planTypes: payerNode.metadata?.planTypes as string[] | undefined,
        states: payerNode.metadata?.states as string[] | undefined,
      };
    });
}

function determineConfidence(sources: StateSource[]): PortabilityConfidence {
  const hasLicense = sources.some((source) => source.type === 'license');
  const hasCompact = sources.some((source) => source.type === 'compact');
  if (hasLicense) return 'high';
  if (hasCompact) return 'medium';
  return 'low';
}

