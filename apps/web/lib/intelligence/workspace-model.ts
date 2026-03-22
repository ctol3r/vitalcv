import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  candidateProviderNpisFromGraphNode,
  findGraphNodeIdForProvider,
  findProviderForGraphNode,
  type IntelligenceAction,
  type IntelligenceFinding,
  type IntelligenceGraphResponse,
  type IntelligenceProvider,
  type IntelligenceStoryline,
} from './contracts';

export interface ProviderWorkspaceStats {
  provider: IntelligenceProvider;
  findingCount: number;
  storylineCount: number;
  linkedFindingIds: string[];
  linkedStorylineIds: string[];
  credentialCount: number;
  activeCredentials: number;
  trustScore: number;
  readinessScore: number;
  riskLevel: IntelligenceProvider['riskLevel'];
  credentialState: IntelligenceProvider['credentialHealth'];
}

export interface StorylineEvidenceLink {
  id: string;
  label: string;
  source: string | null;
  url: string | null;
}

export interface StorylineWorkspaceSummary {
  storyline: IntelligenceStoryline;
  linkedFindings: IntelligenceFinding[];
  providerRelationships: string[];
  evidenceLinks: StorylineEvidenceLink[];
  recommendedNextStep: string | null;
}

export interface IntelligenceWorkspacePayload {
  providers: IntelligenceProvider[];
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceAction[];
  providersByNpi: Map<string, IntelligenceProvider>;
  findingsById: Map<string, IntelligenceFinding>;
  storylinesById: Map<string, IntelligenceStoryline>;
  actionsById: Map<string, IntelligenceAction>;
  providerStatsByNpi: Map<string, ProviderWorkspaceStats>;
  storylineSummaryById: Map<string, StorylineWorkspaceSummary>;
  counts: {
    providers: number;
    findings: number;
    storylines: number;
    actions: number;
    credentials: number;
  };
}

export interface WorkspaceGraphSelection {
  node: GraphNode | null;
  provider: IntelligenceProvider | null;
  finding: IntelligenceFinding | null;
  storyline: IntelligenceStoryline | null;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function collectRelatedNodeIds(
  nodeId: string,
  edges: GraphEdge[],
): string[] {
  return [...new Set(
    edges
      .filter((edge) => edge.source === nodeId || edge.target === nodeId)
      .flatMap((edge) => [edge.source, edge.target]),
  )].filter((candidate) => candidate !== nodeId);
}

function findNodeIdByFindingId(
  graph: IntelligenceGraphResponse | null,
  findingId: string | null | undefined,
): string | null {
  if (!graph || !findingId) {
    return null;
  }

  for (const node of graph.nodes) {
    if (node.findingIds?.includes(findingId)) {
      return node.id;
    }
  }

  for (const edge of graph.edges) {
    if (edge.findingIds?.includes(findingId)) {
      return edge.source ?? edge.target ?? null;
    }
  }

  return null;
}

function findNodeIdByStorylineId(
  graph: IntelligenceGraphResponse | null,
  storylineId: string | null | undefined,
): string | null {
  if (!graph || !storylineId) {
    return null;
  }

  for (const node of graph.nodes) {
    if (node.storylineIds?.includes(storylineId)) {
      return node.id;
    }
  }

  for (const edge of graph.edges) {
    if (edge.storylineIds?.includes(storylineId)) {
      return edge.source ?? edge.target ?? null;
    }
  }

  return null;
}

function findNodeIdByProviderNpi(
  graph: IntelligenceGraphResponse | null,
  providerNpi: string | null | undefined,
): string | null {
  if (!graph || !providerNpi) {
    return null;
  }

  for (const node of graph.nodes) {
    if (candidateProviderNpisFromGraphNode(node).includes(providerNpi)) {
      return node.id;
    }
  }

  return null;
}

export function buildIntelligenceWorkspacePayload(input: {
  providers?: IntelligenceProvider[] | null;
  findings?: IntelligenceFinding[] | null;
  storylines?: IntelligenceStoryline[] | null;
  actions?: IntelligenceAction[] | null;
}): IntelligenceWorkspacePayload {
  const providers = input.providers ?? [];
  const findings = input.findings ?? [];
  const storylines = input.storylines ?? [];
  const actions = input.actions ?? [];

  const providersByNpi = new Map(providers.map((provider) => [provider.npi, provider]));
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  const storylinesById = new Map(storylines.map((storyline) => [storyline.id, storyline]));
  const actionsById = new Map(actions.map((action) => [action.id, action]));

  const providerStatsByNpi = new Map<string, ProviderWorkspaceStats>();
  for (const provider of providers) {
    const linkedFindings = findings.filter((finding) => finding.providerNpi === provider.npi);
    const linkedStorylines = storylines.filter((storyline) => (
      storyline.providerNpi === provider.npi
      || storyline.findingIds.some((findingId) => linkedFindings.some((finding) => finding.id === findingId))
    ));

    providerStatsByNpi.set(provider.npi, {
      provider,
      findingCount: linkedFindings.length,
      storylineCount: linkedStorylines.length,
      linkedFindingIds: linkedFindings.map((finding) => finding.id),
      linkedStorylineIds: linkedStorylines.map((storyline) => storyline.id),
      credentialCount: provider.credentialCount,
      activeCredentials: provider.activeCredentials,
      trustScore: provider.trustScore,
      readinessScore: provider.readinessScore,
      riskLevel: provider.riskLevel,
      credentialState: provider.credentialHealth,
    });
  }

  const storylineSummaryById = new Map<string, StorylineWorkspaceSummary>();
  for (const storyline of storylines) {
    const linkedFindings = storyline.findingIds
      .map((findingId) => findingsById.get(findingId) ?? null)
      .filter((finding): finding is IntelligenceFinding => Boolean(finding));
    const providerRelationships = dedupeStrings([
      storyline.providerNpi,
      ...linkedFindings.map((finding) => finding.providerNpi),
    ]);

    storylineSummaryById.set(storyline.id, {
      storyline,
      linkedFindings,
      providerRelationships,
      evidenceLinks: storyline.evidence
        .map((evidence) => ({
          id: evidence.id,
          label: evidence.label,
          source: evidence.source ?? null,
          url: evidence.url ?? null,
        })),
      recommendedNextStep: storyline.recommendedActions[0] ?? null,
    });
  }

  return {
    providers,
    findings,
    storylines,
    actions,
    providersByNpi,
    findingsById,
    storylinesById,
    actionsById,
    providerStatsByNpi,
    storylineSummaryById,
    counts: {
      providers: providers.length,
      findings: findings.length,
      storylines: storylines.length,
      actions: actions.length,
      credentials: providers.reduce((total, provider) => total + provider.credentialCount, 0),
    },
  };
}

export function resolveGraphFocusNodeId(input: {
  graph: IntelligenceGraphResponse | null;
  graphFocus?: string | null;
  provider?: IntelligenceProvider | null;
  finding?: IntelligenceFinding | null;
  storyline?: IntelligenceStoryline | null;
}): string | null {
  const { graph, graphFocus, provider, finding, storyline } = input;
  if (!graph || graph.nodes.length === 0) {
    return null;
  }

  if (graphFocus && graph.nodes.some((node) => node.id === graphFocus)) {
    return graphFocus;
  }

  const focusFindingId = graphFocus && graph.nodes.some((node) => node.findingIds?.includes(graphFocus))
    ? graphFocus
    : finding?.id ?? graphFocus;
  const findingNodeId = findNodeIdByFindingId(graph, focusFindingId);
  if (findingNodeId) {
    return findingNodeId;
  }

  const focusStorylineId = graphFocus && graph.nodes.some((node) => node.storylineIds?.includes(graphFocus))
    ? graphFocus
    : storyline?.id ?? graphFocus;
  const storylineNodeId = findNodeIdByStorylineId(graph, focusStorylineId);
  if (storylineNodeId) {
    return storylineNodeId;
  }

  const providerNodeId = findGraphNodeIdForProvider(provider ?? null, graph.nodes)
    ?? findNodeIdByProviderNpi(graph, graphFocus);
  if (providerNodeId) {
    return providerNodeId;
  }

  return graph.focusNodeId ?? graph.nodes[0]?.id ?? null;
}

export function resolveWorkspaceSelectionFromGraphNode(input: {
  graph: IntelligenceGraphResponse | null;
  nodeId: string | null;
  providers?: IntelligenceProvider[] | null;
  findings?: IntelligenceFinding[] | null;
  storylines?: IntelligenceStoryline[] | null;
}): WorkspaceGraphSelection {
  const graph = input.graph;
  const nodeId = input.nodeId;
  const providers = input.providers ?? [];
  const findings = input.findings ?? [];
  const storylines = input.storylines ?? [];

  if (!graph || !nodeId) {
    return {
      node: null,
      provider: null,
      finding: null,
      storyline: null,
    };
  }

  const node = graph.nodes.find((candidate) => candidate.id === nodeId) ?? null;
  if (!node) {
    return {
      node: null,
      provider: null,
      finding: null,
      storyline: null,
    };
  }

  const relatedNodeIds = collectRelatedNodeIds(node.id, graph.edges);
  const relatedNodes = relatedNodeIds
    .map((candidateId) => graph.nodes.find((candidate) => candidate.id === candidateId) ?? null)
    .filter((candidate): candidate is GraphNode => Boolean(candidate));

  let provider = findProviderForGraphNode(node.id, graph.nodes, providers);
  if (!provider) {
    for (const candidateNpi of [
      ...candidateProviderNpisFromGraphNode(node),
      ...relatedNodes.flatMap((candidate) => candidateProviderNpisFromGraphNode(candidate)),
    ]) {
      provider = providers.find((candidate) => candidate.npi === candidateNpi) ?? null;
      if (provider) {
        break;
      }
    }
  }

  let finding = null as IntelligenceFinding | null;
  for (const findingId of [
    ...(node.findingIds ?? []),
    ...graph.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .flatMap((edge) => edge.findingIds ?? []),
  ]) {
    const candidate = findings.find((entry) => entry.id === findingId) ?? null;
    if (candidate) {
      finding = candidate;
      break;
    }
  }

  let storyline = null as IntelligenceStoryline | null;
  for (const storylineId of [
    ...(node.storylineIds ?? []),
    finding?.storylineId ?? null,
    ...graph.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .flatMap((edge) => edge.storylineIds ?? []),
  ]) {
    if (!storylineId) {
      continue;
    }

    const candidate = storylines.find((entry) => entry.id === storylineId) ?? null;
    if (candidate) {
      storyline = candidate;
      break;
    }
  }

  if (!provider && finding?.providerNpi) {
    provider = providers.find((candidate) => candidate.npi === finding?.providerNpi) ?? null;
  }

  if (!provider && storyline?.providerNpi) {
    provider = providers.find((candidate) => candidate.npi === storyline.providerNpi) ?? null;
  }

  return {
    node,
    provider,
    finding,
    storyline,
  };
}
