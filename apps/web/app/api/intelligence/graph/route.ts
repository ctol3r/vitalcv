import { type NextRequest, NextResponse } from 'next/server';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import { findGraphNodeIdForProvider, summarizeGraph, type IntelligenceProvider } from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

// ── Synthesis helpers ──────────────────────────────────────────────────────────

const TRUST_TIER_COLORS: Record<string, string> = {
  verified: '#22d3ee',
  reviewed: '#a78bfa',
  pending: '#fbbf24',
  flagged: '#f87171',
};

type DirectoryEntry = {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialHealth: string;
  trustScore: number;
  activeCredentials: number;
  credentialCount: number;
  primaryIssuer: string | null;
};

function tierFromScore(score: number, health: string): string {
  if (health === 'REVOKED') return 'flagged';
  if (score >= 85) return 'verified';
  if (score >= 65) return 'reviewed';
  return 'pending';
}

/**
 * Synthesize graph nodes + edges from provider directory entries.
 * Used as a fallback when the graph backend has no nodes yet.
 */
function synthesizeGraphFromProviders(
  providers: DirectoryEntry[],
  focusNpi: string | null,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const now = new Date().toISOString();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Map: issuer name → node id
  const issuerNodeId = new Map<string, string>();

  for (const provider of providers) {
    const tier = tierFromScore(provider.trustScore, provider.credentialHealth);
    const color = TRUST_TIER_COLORS[tier] ?? '#94a3b8';
    const isFocus = focusNpi ? provider.npi === focusNpi : false;

    nodes.push({
      id: provider.npi,
      type: 'provider',
      label: provider.fullName,
      title: provider.specialties.slice(0, 2).join(', ') || 'Healthcare Provider',
      color,
      group: 'providers',
      degree: 0,
      inDegree: 0,
      outDegree: 0,
      layer: 'trust',
      metadata: {
        npi: provider.npi,
        providerNpi: provider.npi,
        trustScore: provider.trustScore,
        credentialHealth: provider.credentialHealth,
        activeCredentials: provider.activeCredentials,
      },
      tags: [tier, provider.credentialHealth, ...provider.specialties.slice(0, 2)].filter(Boolean),
      sourceRefs: [],
      trustTier: tier,
      confidence: Math.round(provider.trustScore) / 100,
      createdAt: now,
      updatedAt: now,
      flagged: provider.credentialHealth === 'REVOKED' || provider.trustScore < 45,
      selected: isFocus,
      size: isFocus ? 12 : provider.trustScore >= 85 ? 9 : 7,
    } as GraphNode);

    // Institution / issuer node
    if (provider.primaryIssuer) {
      const slug = provider.primaryIssuer.replace(/\s+/g, '-').toLowerCase().slice(0, 60);
      const id = `issuer:${slug}`;

      if (!issuerNodeId.has(id)) {
        issuerNodeId.set(id, id);
        nodes.push({
          id,
          type: 'institution',
          label: provider.primaryIssuer,
          title: 'Issuing Institution',
          color: '#34d399',
          group: 'institutions',
          degree: 0,
          inDegree: 0,
          outDegree: 0,
          layer: 'knowledge',
          metadata: {},
          tags: ['institution', 'issuer'],
          sourceRefs: [],
          createdAt: now,
          updatedAt: now,
        } as GraphNode);
      }

      const edgeId = `issued:${provider.npi}:${id}`;
      edges.push({
        id: edgeId,
        source: provider.npi,
        target: id,
        type: 'issued_by',
        directed: true,
        reciprocal: false,
        confidence: 0.9,
        createdBy: 'synthesis',
        explanation: `${provider.fullName} credentials issued by ${provider.primaryIssuer}`,
        status: 'active',
        weight: 1,
        metadata: {},
        layer: 'trust',
        createdAt: now,
      } as GraphEdge);
    }
  }

  // Backfill degree counts
  const degreeIn = new Map<string, number>();
  const degreeOut = new Map<string, number>();
  for (const edge of edges) {
    degreeOut.set(edge.source, (degreeOut.get(edge.source) ?? 0) + 1);
    degreeIn.set(edge.target, (degreeIn.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes) {
    node.inDegree = degreeIn.get(node.id) ?? 0;
    node.outDegree = degreeOut.get(node.id) ?? 0;
    node.degree = node.inDegree + node.outDegree;
  }

  return { nodes, edges };
}

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

    let nodes = (upstream.payload.nodes ?? []) as GraphNode[];
    let edges = (upstream.payload.edges ?? []) as GraphEdge[];

    // ── Synthesis fallback: if the graph engine has no nodes yet, build from providers ──
    if (nodes.length === 0) {
      const directoryParams = new URLSearchParams({
        limit: npi && NPI_RE.test(npi) ? '1' : '60',
        pageSize: npi && NPI_RE.test(npi) ? '1' : '60',
        orphans: 'false',
      });
      if (npi && NPI_RE.test(npi)) {
        directoryParams.set('npi', npi);
      }

      const directory = await fetchBackendJson<{
        entries?: DirectoryEntry[];
        total?: number;
      }>('/api/directory', directoryParams, 10_000, { context: authContext }).catch(() => null);

      const entries: DirectoryEntry[] = directory?.ok
        ? (directory.payload.entries ?? []).slice(0, 80)
        : [];

      if (entries.length > 0) {
        const synthesized = synthesizeGraphFromProviders(entries, npi ?? null);
        nodes = synthesized.nodes;
        edges = synthesized.edges;

        // Enrich synthesized provider nodes with finding counts from the investigator engine
        const findingsResult = await fetchBackendJson<{
          findings?: Array<{
            entityIds: string[];
            severity: string;
          }>;
        }>('/api/findings', new URLSearchParams({ limit: '100' }), 10_000, { context: authContext }).catch(() => null);

        if (findingsResult?.ok) {
          const countsByNpi = new Map<string, { total: number; critical: number }>();
          for (const finding of findingsResult.payload.findings ?? []) {
            for (const entityId of finding.entityIds) {
              const counts = countsByNpi.get(entityId) ?? { total: 0, critical: 0 };
              counts.total++;
              if (finding.severity === 'critical' || finding.severity === 'high') {
                counts.critical++;
              }
              countsByNpi.set(entityId, counts);
            }
          }

          for (const node of nodes) {
            if (node.type === 'provider') {
              const counts = countsByNpi.get(node.id);
              node.metadata = {
                ...node.metadata,
                findingCount: counts?.total ?? 0,
                hasCriticalFindings: (counts?.critical ?? 0) > 0,
              };
              if (counts && counts.critical > 0) {
                node.flagged = true;
              }
            }
          }
        }
      }
    }

    const focusNodeId = npi
      ? (nodes.find((n) => n.id === npi || (n.metadata as Record<string, unknown>)?.npi === npi || (n.metadata as Record<string, unknown>)?.providerNpi === npi)?.id
        ?? findGraphNodeIdForProvider(
          {
            id: npi,
            npi,
            name: npi,
            specialties: [],
            credentialHealth: 'PENDING',
            trustScore: 0,
            activeCredentials: 0,
            credentialCount: 0,
            primaryIssuer: null,
            lastVerifiedAt: null,
            summary: '',
            tags: [],
            risk: 'neutral',
          } satisfies IntelligenceProvider,
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
