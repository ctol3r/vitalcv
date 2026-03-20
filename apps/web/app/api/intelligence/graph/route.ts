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
const PROVIDER_NODE_COLOR = '#22c55e';
const SOURCE_NODE_COLOR = '#38bdf8';

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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function createProviderNode(finding: IntelligenceFinding): GraphNode {
  const npi = finding.providerNpi ?? `finding-provider:${finding.id}`;
  const label = finding.providerLabel ?? (finding.providerNpi ? `Provider ${finding.providerNpi}` : `Finding ${finding.id}`);
  const trustScore = finding.confidence > 0 ? Math.round(finding.confidence * 100) : 50;
  const provider = computeProviderView({
    npi,
    fullName: label,
    trustScore,
    readinessScore: trustScore,
    credentialHealth: 'PENDING',
    activeCredentials: 0,
    credentialCount: 0,
    summary: finding.summary,
  });
  const timestamp = finding.updatedAt ?? finding.firstSeenAt;

  return {
    id: provider.npi,
    type: 'provider',
    label: provider.name,
    title: finding.summary,
    color: PROVIDER_NODE_COLOR,
    group: 'providers',
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    layer: 'trust',
    metadata: {
      npi: provider.npi,
      providerNpi: provider.npi,
      trustScore: provider.trustScore,
      readinessScore: provider.readinessScore,
      riskLevel: provider.riskLevel,
      credentialCount: provider.credentialCount,
    },
    tags: provider.tags,
    sourceRefs: [],
    trustTier: provider.riskLevel,
    trustBand: provider.riskLevel,
    trustScore: provider.trustScore,
    confidence: finding.confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
    flagged: finding.severity === 'critical' || finding.severity === 'high',
    findingIds: [finding.id],
    storylineIds: finding.storylineId ? [finding.storylineId] : [],
  };
}

function createSourceNode(finding: IntelligenceFinding, sourceLabel: string, evidenceId: string): GraphNode {
  const timestamp = finding.updatedAt ?? finding.firstSeenAt;

  return {
    id: `source:${slugify(sourceLabel) || evidenceId}`,
    type: 'source',
    label: sourceLabel,
    title: finding.title,
    color: SOURCE_NODE_COLOR,
    group: 'evidence',
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    layer: 'knowledge',
    metadata: {
      findingId: finding.id,
      providerNpi: finding.providerNpi,
      storylineId: finding.storylineId,
    },
    tags: ['evidence-source'],
    sourceRefs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    findingIds: [finding.id],
    storylineIds: finding.storylineId ? [finding.storylineId] : [],
  };
}

function createEvidenceEdge(finding: IntelligenceFinding, providerNodeId: string, sourceNodeId: string, evidenceIndex: number): GraphEdge {
  const evidence = finding.evidence[evidenceIndex];
  const timestamp = evidence?.observedAt ?? finding.updatedAt ?? finding.firstSeenAt;

  return {
    id: `evidence:${finding.id}:${evidence?.id ?? evidenceIndex}`,
    source: providerNodeId,
    target: sourceNodeId,
    type: 'evidence_link',
    directed: true,
    reciprocal: false,
    confidence: evidence?.confidence ?? finding.confidence,
    createdBy: 'finding-synthesis',
    explanation: evidence?.snippet ?? finding.summary,
    status: 'active',
    weight: 1,
    metadata: {
      findingId: finding.id,
      providerNpi: finding.providerNpi,
      evidenceId: evidence?.id ?? null,
      evidenceType: evidence?.type ?? evidence?.label ?? null,
    },
    layer: 'blended',
    createdAt: timestamp,
    updatedAt: timestamp,
    findingIds: [finding.id],
    storylineIds: finding.storylineId ? [finding.storylineId] : [],
    evidenceCount: 1,
    evidenceRefs: evidence ? [{
      evidenceId: evidence.id,
      source: evidence.source,
      summary: evidence.snippet ?? evidence.label,
      observedAt: evidence.observedAt,
      findingId: finding.id,
      storylineId: finding.storylineId,
      url: evidence.url ?? null,
    }] : [],
  };
}

function ensureNode(nodeMap: Map<string, GraphNode>, nextNode: GraphNode): GraphNode {
  const existing = nodeMap.get(nextNode.id);
  if (!existing) {
    nodeMap.set(nextNode.id, nextNode);
    return nextNode;
  }

  existing.findingIds = mergeStringLists(existing.findingIds, nextNode.findingIds);
  existing.storylineIds = mergeStringLists(existing.storylineIds, nextNode.storylineIds);
  existing.tags = [...new Set([...(existing.tags ?? []), ...(nextNode.tags ?? [])])];
  existing.metadata = {
    ...existing.metadata,
    ...nextNode.metadata,
  };
  existing.updatedAt = nextNode.updatedAt ?? existing.updatedAt;
  return existing;
}

function ensureEdge(edgeMap: Map<string, GraphEdge>, nextEdge: GraphEdge): void {
  const existing = edgeMap.get(nextEdge.id);
  if (!existing) {
    edgeMap.set(nextEdge.id, nextEdge);
    return;
  }

  existing.findingIds = mergeStringLists(existing.findingIds, nextEdge.findingIds);
  existing.storylineIds = mergeStringLists(existing.storylineIds, nextEdge.storylineIds);
  existing.evidenceRefs = [...(existing.evidenceRefs ?? []), ...(nextEdge.evidenceRefs ?? [])];
  existing.evidenceCount = existing.evidenceRefs?.length ?? existing.evidenceCount ?? 0;
}

function synthesizeGraphFromFindings(
  findings: IntelligenceFinding[],
  input: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    npi: string | null;
  },
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map(input.nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(input.edges.map((edge) => [edge.id, edge]));

  for (const finding of findings) {
    const providerNode = createProviderNode(finding);
    const existingProviderNodeId = input.nodes.find((node) => (
      candidateProviderNpisFromGraphNode(node).includes(providerNode.id)
    ))?.id;
    const ensuredProviderNode = ensureNode(
      nodeMap,
      existingProviderNodeId
        ? { ...providerNode, id: existingProviderNodeId }
        : providerNode,
    );

    const evidences = finding.evidence.length > 0
      ? finding.evidence
      : [{
          id: `synthetic:${finding.id}`,
          label: 'evidence',
          type: 'evidence',
          snippet: finding.summary,
          source: finding.providerLabel ?? finding.providerNpi ?? 'finding source',
          observedAt: finding.updatedAt,
        }];

    evidences.forEach((evidence, index) => {
      const sourceLabel = evidence.source ?? evidence.label ?? `Evidence ${index + 1}`;
      const sourceNode = ensureNode(nodeMap, createSourceNode(finding, sourceLabel, evidence.id));
      ensureEdge(edgeMap, createEvidenceEdge(finding, ensuredProviderNode.id, sourceNode.id, index));
    });
  }

  if (findings.length > 0 && nodeMap.size === 0) {
    const fallbackFinding = findings[0];
    const providerNode = ensureNode(nodeMap, createProviderNode(fallbackFinding));
    const sourceNode = ensureNode(nodeMap, createSourceNode(
      fallbackFinding,
      fallbackFinding.providerLabel ?? fallbackFinding.providerNpi ?? 'evidence',
      `fallback:${fallbackFinding.id}`,
    ));
    ensureEdge(edgeMap, createEvidenceEdge(fallbackFinding, providerNode.id, sourceNode.id, 0));
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();

  for (const edge of edges) {
    outbound.set(edge.source, (outbound.get(edge.source) ?? 0) + 1);
    inbound.set(edge.target, (inbound.get(edge.target) ?? 0) + 1);
  }

  for (const node of nodes) {
    node.inDegree = inbound.get(node.id) ?? node.inDegree ?? 0;
    node.outDegree = outbound.get(node.id) ?? node.outDegree ?? 0;
    node.degree = node.inDegree + node.outDegree;
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

    const findingsUpstream = await fetchBackendJson<{
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
    }), 12_000, { context: authContext }).catch(() => null);

    let nodes = (upstream.payload.nodes ?? []) as GraphNode[];
    let edges = (upstream.payload.edges ?? []) as GraphEdge[];
    const findings = findingsUpstream?.ok
      ? normalizeFindingsPayload(findingsUpstream.payload).findings
      : [];

    if (findings.length > 0) {
      const synthesized = synthesizeGraphFromFindings(findings, {
        nodes,
        edges,
        npi: npi ?? null,
      });
      nodes = synthesized.nodes;
      edges = synthesized.edges;
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
