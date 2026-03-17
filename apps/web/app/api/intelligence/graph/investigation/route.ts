import { type NextRequest, NextResponse } from 'next/server';
import {
  authFailureStatus,
  buildAuthFailurePayload,
  fetchBackendJson,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../../_shared';
import { normalizeInvestigationGraphPayload } from '@/lib/intelligence/contracts';

export const runtime = 'nodejs';

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

function buildBackendInvestigationParams(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const providerId = searchParams.get('providerId') ?? searchParams.get('npi');

  if (providerId) {
    params.set('providerId', providerId);
  }

  appendIfPresent(params, searchParams, 'focusNodeId');
  appendIfPresent(params, searchParams, 'findingId');
  appendIfPresent(params, searchParams, 'storylineId');
  appendIfPresent(params, searchParams, 'sourceNodeId');
  appendIfPresent(params, searchParams, 'targetNodeId');
  appendIfPresent(params, searchParams, 'dateFrom');
  appendIfPresent(params, searchParams, 'dateTo');
  appendIfPresent(params, searchParams, 'depth');

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

  const limit = parsePositiveInt(searchParams.get('limit'), 40, 120);
  params.set('limit', String(limit));

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

  try {
    const upstream = await fetchBackendJson<unknown>(
      '/api/graph/investigation',
      buildBackendInvestigationParams(req.nextUrl.searchParams),
      20_000,
      { context: authContext },
    );

    if (!upstream.ok) {
      return NextResponse.json(upstream.payload, { status: upstream.status });
    }

    return NextResponse.json(normalizeInvestigationGraphPayload(upstream.payload));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'graph_proxy_failed',
        error_description: error instanceof Error ? error.message : 'Failed to load investigation graph.',
      },
      { status: 502 },
    );
  }
}
