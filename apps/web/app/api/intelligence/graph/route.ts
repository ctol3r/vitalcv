import { type NextRequest, NextResponse } from 'next/server';
import { findGraphNodeIdForProvider, summarizeGraph, type IntelligenceProvider } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

export const runtime = 'nodejs';

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
    const upstream = await fetchBackendJson<{
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
      npi && /^\d{10}$/.test(npi) ? `/api/graph/${npi}` : '/api/graph/global',
      params,
      20_000,
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Graph upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const nodes = (upstream.payload.nodes ?? []) as never[];
    const edges = (upstream.payload.edges ?? []) as never[];
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
        nodes as never[],
      )
      : null;

    return NextResponse.json({
      nodes,
      edges,
      stats: summarizeGraph(nodes as never[], edges as never[]),
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
