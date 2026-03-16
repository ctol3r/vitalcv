import { type NextRequest, NextResponse } from 'next/server';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import { findGraphNodeIdForProvider, summarizeGraph, type IntelligenceProvider } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

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
      }>(
        graphPath,
        params,
        20_000,
      ),
      npi && NPI_RE.test(npi)
        ? fetchBackendJson<ProviderSignalPreview & {
          trust: ProviderSignalPreview['trust'];
          influence: ProviderSignalPreview['influence'];
          workforcePressure: ProviderSignalPreview['workforcePressure'];
          institutionMomentum: ProviderSignalPreview['institutionMomentum'];
          earlyWarnings: ProviderSignalPreview['earlyWarnings'];
          summary: string;
        }>(`/api/provider-intelligence/${npi}`, new URLSearchParams({ limit: '10', sync: 'false' }), 20_000)
        : Promise.resolve(null),
    ]);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Graph upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const nodes = (upstream.payload.nodes ?? []) as GraphNode[];
    const edges = (upstream.payload.edges ?? []) as GraphEdge[];
    const focusNodeId = npi
      ? findGraphNodeIdForProvider(
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
      )
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

    return NextResponse.json({
      nodes,
      edges,
      stats: summarizeGraph(nodes, edges),
      focusNodeId,
      generatedAt: upstream.payload.generatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load graph intelligence',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
