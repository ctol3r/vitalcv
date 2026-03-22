import { type NextRequest, NextResponse } from 'next/server';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  candidateProviderNpisFromGraphNode,
  computeProviderView,
  findGraphNodeIdForProvider,
  normalizeFindingsPayload,
  summarizeGraph,
  type IntelligenceFinding,
} from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';
const NPI_RE = /^\d{10}$/;

type ProviderSignalPreview = {
  trust?: {
    score: number | null;
    tier: string;
    confidence: number;
  };
  influence?: {
    score: number | null;
    tier: string;
    percentile: number | null;
    confidence: number;
  };
  workforcePressure?: {
    state: string;
    score: number | null;
  };
  institutionMomentum?: {
    state: string;
    label: string;
  } | null;
  earlyWarnings?: Array<{
    id: string;
    type: string;
    headline: string;
  }>;
  summary?: string;
};

function enrichFocusedProviderNode(
  node: GraphNode | undefined,
  preview: ProviderSignalPreview | null,
) {
  if (!node || !preview) {
    return;
  }

  const nextTags = new Set(node.tags ?? []);
  if (preview.trust?.tier) {
    nextTags.add(preview.trust.tier);
  }
  if (preview.influence?.tier) {
    nextTags.add(preview.influence.tier);
  }
  if (preview.workforcePressure?.state) {
    nextTags.add(`pressure:${preview.workforcePressure.state}`);
  }
  if (preview.earlyWarnings && preview.earlyWarnings.length > 0) {
    nextTags.add(`warnings:${preview.earlyWarnings.length}`);
  }

  node.tags = [...nextTags].slice(0, 8);
  node.metadata = {
    ...node.metadata,
    signalPreview: preview,
  };
}

function mergeStringLists(existing: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  const merged = [...new Set([...(existing ?? []), ...(incoming ?? [])])];
  return merged.length > 0 ? merged : undefined;
}

function annotateNodeWithFinding(
  node: GraphNode,
  finding: IntelligenceFinding,
): void {
  node.findingIds = mergeStringLists(node.findingIds, [finding.id]);
  node.storylineIds = mergeStringLists(
    node.storylineIds,
    finding.storylineId ? [finding.storylineId] : undefined,
  );
  node.flagged = node.flagged || finding.severity === 'critical' || finding.severity === 'high';
  node.confidence = Math.max(node.confidence ?? 0, finding.confidence);
  node.metadata = {
    ...node.metadata,
    providerNpi: finding.providerNpi ?? (node.metadata as Record<string, unknown>)?.providerNpi ?? null,
    liveSignalCount: Math.max(
      (node.findingIds?.length ?? 0),
      typeof (node.metadata as Record<string, unknown>)?.liveSignalCount === 'number'
        ? ((node.metadata as Record<string, unknown>).liveSignalCount as number)
        : 0,
    ),
  };
}

function annotateGraphFromFindings(
  findings: IntelligenceFinding[],
  input: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    npi: string | null;
  },
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = input.nodes.map((node) => ({
    ...node,
    metadata: { ...node.metadata },
    tags: [...node.tags],
    findingIds: node.findingIds ? [...node.findingIds] : undefined,
    storylineIds: node.storylineIds ? [...node.storylineIds] : undefined,
  }));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const providerNodeIdsByNpi = new Map<string, Set<string>>();

  for (const node of nodes) {
    for (const candidateNpi of candidateProviderNpisFromGraphNode(node)) {
      const ids = providerNodeIdsByNpi.get(candidateNpi) ?? new Set<string>();
      ids.add(node.id);
      providerNodeIdsByNpi.set(candidateNpi, ids);
    }
  }

  for (const finding of findings) {
    if (!finding.providerNpi) {
      continue;
    }

    const providerNodeIds = providerNodeIdsByNpi.get(finding.providerNpi);
    if (!providerNodeIds) {
      continue;
    }

    for (const nodeId of providerNodeIds) {
      const node = nodeMap.get(nodeId);
      if (node) {
        annotateNodeWithFinding(node, finding);
      }
    }
  }

  const edges = input.edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    return {
      ...edge,
      metadata: { ...edge.metadata },
      findingIds: mergeStringLists(
        edge.findingIds,
        mergeStringLists(sourceNode?.findingIds, targetNode?.findingIds),
      ),
      storylineIds: mergeStringLists(
        edge.storylineIds,
        mergeStringLists(sourceNode?.storylineIds, targetNode?.storylineIds),
      ),
    };
  });

  for (const node of nodes) {
    if (input.npi && candidateProviderNpisFromGraphNode(node).includes(input.npi)) {
      node.selected = true;
    }
  }

  return { nodes, edges };
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  const npi = req.nextUrl.searchParams.get('npi');
  const layer = req.nextUrl.searchParams.get('layer') ?? 'blended';
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 240, 600);

  const params = new URLSearchParams({
    graphMode: layer,
    limit: String(limit),
    orphans: 'true',
  });

  try {
    const graphPath = npi && NPI_RE.test(npi) ? `/api/graph/${npi}` : '/api/graph/global';
    const [upstream, signalSummary] = await Promise.all([
      fetchBackendJson<{
        nodes?: Array<{
          id: string;
          metadata?: Record<string, unknown>;
        }>;
        edges?: Array<{
          id: string;
          source: string;
          target: string;
          type: string;
        }>;
        generatedAt?: string;
        snapshotReady?: boolean;
      }>(
        graphPath,
        params,
        20_000,
        { context: authContext },
      ),
      npi && NPI_RE.test(npi)
        ? fetchBackendJson<ProviderSignalPreview & {
          trust: ProviderSignalPreview['trust'];
          influence: ProviderSignalPreview['influence'];
          workforcePressure: ProviderSignalPreview['workforcePressure'];
          institutionMomentum: ProviderSignalPreview['institutionMomentum'];
          earlyWarnings: ProviderSignalPreview['earlyWarnings'];
          summary: string;
        }>(
          `/api/provider-intelligence/${npi}`,
          new URLSearchParams({ limit: '10', sync: 'false' }),
          20_000,
          { context: authContext },
        )
        : Promise.resolve(null),
    ]);

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Graph backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    const [findingsUpstream, storylinesUpstream] = await Promise.all([
      fetchBackendJson<{
        findings?: Array<{
          findingId: string;
          investigatorId: string;
          findingType: string;
          severity: string;
          status: string;
          title: string;
          summary: string;
          explanation: string;
          entityIds?: string[];
          entities?: Array<{
            entityType?: string;
            entityId?: string;
            entityLabel?: string | null;
          }>;
          metadata?: Record<string, unknown>;
          priorityScore: number;
          confidence: number;
          storylineKey: string | null;
          supportingEvidence?: Array<{
            evidenceId?: string;
            evidenceType?: string;
            snippet?: string | null;
            sourceLabel?: string | null;
            sourceId?: string | null;
            observedAt?: string | null;
            confidence?: number | null;
            relevance?: number | null;
            url?: string | null;
            metadata?: Record<string, unknown>;
          }>;
          updatedAt: string;
        }>;
        total?: number;
      }>('/api/findings', new URLSearchParams({
        limit: String(Math.min(100, Math.max(20, Math.floor(limit / 2)))),
        offset: '0',
        ...(npi && NPI_RE.test(npi) ? { provider: npi } : {}),
      }), 12_000, { context: authContext }).catch(() => null),
      fetchBackendJson<{
        storylines?: Array<unknown>;
        total?: number;
      }>('/api/storylines', new URLSearchParams({
        limit: '20',
        ...(npi && NPI_RE.test(npi) ? { provider: npi } : {}),
      }), 12_000, { context: authContext }).catch(() => null),
    ]);

    let nodes = (upstream.payload.nodes ?? []) as GraphNode[];
    let edges = (upstream.payload.edges ?? []) as GraphEdge[];
    const findings = findingsUpstream?.ok
      ? normalizeFindingsPayload(findingsUpstream.payload).findings
      : [];
    const storylineCount = storylinesUpstream?.ok
      ? (
        storylinesUpstream.payload.total
        ?? storylinesUpstream.payload.storylines?.length
        ?? 0
      )
      : 0;

    if (nodes.length === 0 && (findings.length > 0 || storylineCount > 0)) {
      return NextResponse.json(
        {
          error: 'graph_data_inconsistent',
          error_description: `Graph backend returned zero nodes while ${findings.length} finding${findings.length === 1 ? '' : 's'} and ${storylineCount} storyline${storylineCount === 1 ? '' : 's'} remain in scope.`,
        },
        { status: 409 },
      );
    }

    if (findings.length > 0) {
      const annotated = annotateGraphFromFindings(findings, {
        nodes,
        edges,
        npi: npi ?? null,
      });
      nodes = annotated.nodes;
      edges = annotated.edges;
    }

    const focusNodeId = npi
      ? (nodes.find((n) => n.id === npi || (n.metadata as Record<string, unknown>)?.npi === npi || (n.metadata as Record<string, unknown>)?.providerNpi === npi)?.id
        ?? findGraphNodeIdForProvider(
          computeProviderView({
            npi,
            fullName: npi,
            credentialHealth: 'PENDING',
            trustScore: 0,
            readinessScore: 0,
            activeCredentials: 0,
            credentialCount: 0,
          }),
          nodes,
        ))
      : null;
    const focusNode = focusNodeId
      ? nodes.find((node) => node.id === focusNodeId)
      : undefined;

    if (signalSummary?.ok) {
      enrichFocusedProviderNode(focusNode, {
        trust: signalSummary.payload.trust,
        influence: signalSummary.payload.influence,
        workforcePressure: signalSummary.payload.workforcePressure,
        institutionMomentum: signalSummary.payload.institutionMomentum,
        earlyWarnings: signalSummary.payload.earlyWarnings,
        summary: signalSummary.payload.summary,
      });
    }

    return NextResponse.json(attachAccessMetadata({
      nodes,
      edges,
      stats: summarizeGraph(nodes, edges),
      focusNodeId: focusNodeId ?? null,
      generatedAt: upstream.payload.generatedAt ?? new Date().toISOString(),
    }, {
      accessMode: 'full',
      reason: 'ok',
    }));
  } catch (error) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'Graph request failed.',
      },
      { status: 503 },
    );
  }
}
