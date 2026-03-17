import { type NextRequest, NextResponse } from 'next/server';
import {
  authFailureStatus,
  buildAuthFailurePayload,
  fetchBackendJson,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../../../_shared';
import { normalizeInvestigationGraphPayload } from '@/lib/intelligence/contracts';

export const runtime = 'nodejs';

function appendIfPresent(
  output: URLSearchParams,
  input: URLSearchParams,
  key: string,
  outgoingKey = key,
) {
  const value = input.get(key);
  if (!value) {
    return;
  }

  output.set(outgoingKey, value);
}

function appendCsvOrRepeated(
  output: URLSearchParams,
  input: URLSearchParams,
  incomingKey: string,
  outgoingKey: string,
) {
  const repeated = input.getAll(incomingKey)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (const value of repeated) {
    output.append(outgoingKey, value);
  }
}

function buildExpansionParams(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const focusNodeId = searchParams.get('nodeId') ?? searchParams.get('focusNodeId');
  const providerId = searchParams.get('providerId') ?? searchParams.get('npi');

  if (providerId) {
    params.set('providerId', providerId);
  }

  if (focusNodeId) {
    params.set('focusNodeId', focusNodeId);
  }

  appendIfPresent(params, searchParams, 'findingId');
  appendIfPresent(params, searchParams, 'storylineId');
  appendIfPresent(params, searchParams, 'dateFrom');
  appendIfPresent(params, searchParams, 'dateTo');
  appendCsvOrRepeated(params, searchParams, 'entityType', 'entityTypes');
  appendCsvOrRepeated(params, searchParams, 'relationshipType', 'relationshipTypes');

  const onlyFlagged = searchParams.get('onlyFlagged');
  if (onlyFlagged === 'true' || onlyFlagged === 'false') {
    params.set('onlyFlagged', onlyFlagged);
  }

  const onlyStorylineRelated = searchParams.get('onlyStorylineRelated');
  if (onlyStorylineRelated === 'true' || onlyStorylineRelated === 'false') {
    params.set('onlyStorylineRelated', onlyStorylineRelated);
  }

  params.set('depth', '1');
  params.set('limit', String(parsePositiveInt(searchParams.get('limit'), 24, 80)));

  return params;
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(
      buildAuthFailurePayload(authContext),
      { status: authFailureStatus(authContext) },
    );
  }

  const focusNodeId = req.nextUrl.searchParams.get('nodeId') ?? req.nextUrl.searchParams.get('focusNodeId');
  if (!focusNodeId) {
    return NextResponse.json(
      {
        error: 'focus_node_required',
        error_description: 'nodeId is required for graph expansion.',
      },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetchBackendJson<unknown>(
      '/api/graph/investigation',
      buildExpansionParams(req.nextUrl.searchParams),
      20_000,
      { context: authContext },
    );

    if (!upstream.ok) {
      return NextResponse.json(upstream.payload, { status: upstream.status });
    }

    const payload = normalizeInvestigationGraphPayload(upstream.payload);
    const nodes = payload.nodes.map((node) => (
      node.id === focusNodeId
        ? node
        : {
          ...node,
          metadata: {
            ...node.metadata,
            expandedFromNodeId: focusNodeId,
          },
        }
    ));
    const edges = payload.edges.map((edge) => ({
      ...edge,
      animatedFromNodeId: focusNodeId,
    }));

    return NextResponse.json({
      ...payload,
      nodes,
      edges,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'graph_expand_proxy_failed',
        error_description: error instanceof Error ? error.message : 'Failed to expand investigation graph.',
      },
      { status: 502 },
    );
  }
}
