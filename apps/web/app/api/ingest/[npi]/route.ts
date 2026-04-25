import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { fetchNppesIdentityFallback } from '@/lib/sources/nppes-fallback';

export const runtime = 'nodejs';

/**
 * Ingest proxy — Wave LIVE-100C P0-A rescue + LIVE-101 source-backed
 * readiness recovery.
 *
 * Recovery rules added in LIVE-101:
 *   - When upstream fails, attempt a direct NPPES public-registry
 *     fetch as the identity lane fallback. NPPES is public, no-PHI,
 *     no auth — safe to call from the proxy. On success, the NPPES
 *     lane is `source_backed` instead of `pending`.
 *   - Every lane carries a `cadence` so the consumer cannot mistake
 *     a snapshot for real-time:
 *       NPPES        → live          (public registry, queried on demand)
 *       OIG_LEIE     → monthly       (federal exclusion list refresh)
 *       PECOS_PUBLIC → quarterly     (Medicare FFS public release)
 *       STATE_BOARD  → lane_dependent
 *   - State board lane stays `access_required` unless real adapter
 *     evidence has reached the proxy. We do not flip it to checked
 *     on a hopeful fallback.
 *   - Lane state vocabulary:
 *     source_backed | pending | unavailable | access_required | stale.
 *     `verified` is never emitted by the fallback path.
 */

export type LaneCadence = 'live' | 'monthly' | 'quarterly' | 'lane_dependent';
export type LaneState =
  | 'source_backed'
  | 'pending'
  | 'unavailable'
  | 'access_required'
  | 'stale';

export interface FallbackLane {
  source: 'NPPES' | 'OIG_LEIE' | 'PECOS_PUBLIC' | 'STATE_BOARD';
  state: LaneState;
  cadence: LaneCadence;
  detail: string;
  /** Source URL recorded as receipt-style attribution (NPPES fallback only today). */
  sourceUrl?: string;
  /** ISO-8601 timestamp of when the lane evidence was read. */
  readAt?: string;
  /** Projection of source-backed identity fields (NPPES only today). */
  identity?: {
    displayName: string;
    enumerationType: 'NPI-1' | 'NPI-2' | 'unknown';
    taxonomy: string | null;
    enumerationDate: string | null;
    lastUpdated: string | null;
    nppesStatus: 'A' | 'I' | 'unknown';
    practiceState: string | null;
  };
}

type UpstreamFailureReason = 'timeout' | 'network' | 'non_json' | 'upstream_5xx' | 'upstream_4xx';

interface FallbackBody {
  ok: boolean;
  fallback: true;
  reason: UpstreamFailureReason;
  npi: string;
  runId: null;
  runIdReason: string;
  lanes: FallbackLane[];
  message: string;
  truth: {
    unavailable_is_not_blocked: true;
    access_required_is_not_clinician_fault: true;
    unknown_is_not_negative: true;
    nppes_is_identity_only: true;
    oig_leie_is_not_real_time: true;
    pecos_public_is_not_real_time: true;
  };
}

function unavailableLanes(): FallbackLane[] {
  return [
    {
      source: 'NPPES',
      state: 'unavailable',
      cadence: 'live',
      detail:
        'NPPES public registry was not reachable. NPPES confirms identity only — never licensure validity.',
    },
    {
      source: 'OIG_LEIE',
      state: 'unavailable',
      cadence: 'monthly',
      detail:
        'Federal exclusion list refresh runs monthly; current snapshot was not reachable. Not a real-time OIG feed.',
    },
    {
      source: 'PECOS_PUBLIC',
      state: 'unavailable',
      cadence: 'quarterly',
      detail:
        'Medicare FFS public enrollment is a quarterly release. Latest snapshot was not reachable; this is not the real-time PECOS portal.',
    },
    {
      source: 'STATE_BOARD',
      state: 'access_required',
      cadence: 'lane_dependent',
      detail:
        'State board lane requires institutional access (Nursys / FSMB / state portal). Not a clinician defect.',
    },
  ];
}

async function buildLanesWithNppesFallback(npi: string): Promise<FallbackLane[]> {
  const lanes = unavailableLanes();
  const nppes = await fetchNppesIdentityFallback(npi);
  if (nppes.ok) {
    lanes[0] = {
      source: 'NPPES',
      state: 'source_backed',
      cadence: 'live',
      detail:
        'NPPES public registry confirmed identity at fetch time. Identity only — does not confirm licensure validity.',
      sourceUrl: nppes.sourceUrl,
      readAt: nppes.fetchedAt,
      identity: nppes.identity,
    };
  }
  return lanes;
}

async function fallbackResponse(npi: string, reason: UpstreamFailureReason): Promise<NextResponse> {
  const lanes = await buildLanesWithNppesFallback(npi);
  const nppesRecovered = lanes[0].state === 'source_backed';

  const body: FallbackBody = {
    ok: nppesRecovered,
    fallback: true,
    reason,
    npi,
    runId: null,
    runIdReason:
      'No ingest run was created because the backend ingest start did not return a usable response. Fallback lanes are read-only recovery evidence.',
    lanes,
    message: messageFor(reason, nppesRecovered),
    truth: {
      unavailable_is_not_blocked: true,
      access_required_is_not_clinician_fault: true,
      unknown_is_not_negative: true,
      nppes_is_identity_only: true,
      oig_leie_is_not_real_time: true,
      pecos_public_is_not_real_time: true,
    },
  };

  return NextResponse.json(body, { status: 200 });
}

function messageFor(reason: UpstreamFailureReason, nppesRecovered: boolean): string {
  const tail = nppesRecovered
    ? ' NPPES public-registry identity was retrieved as a fallback so the visitor can still see source-backed identity.'
    : '';
  switch (reason) {
    case 'timeout':
      return `The readiness pipeline timed out. Source checks will retry; try again in a moment.${tail}`;
    case 'network':
      return `The readiness pipeline is temporarily unreachable. Source checks will retry.${tail}`;
    case 'non_json':
      return `The readiness pipeline returned an unexpected response. Source checks are queued to retry.${tail}`;
    case 'upstream_4xx':
      return `The readiness request was refused upstream. No source check was performed against this NPI.${tail}`;
    case 'upstream_5xx':
    default:
      return `The readiness pipeline is temporarily degraded. Source checks are queued.${tail}`;
  }
}

function isValidNpiShape(raw: string): boolean {
  return typeof raw === 'string' && /^\d{10}$/.test(raw);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
): Promise<NextResponse> {
  const { npi } = await context.params;
  const cleanNpi = (npi ?? '').trim();

  if (!isValidNpiShape(cleanNpi)) {
    return NextResponse.json(
      {
        ok: false,
        fallback: false,
        reason: 'invalid_npi',
        message: 'NPI must be exactly 10 digits.',
        npi: cleanNpi,
      },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetchWithTimeout(
      `${B}/api/ingest/${cleanNpi}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Public wedge org context — required while backend tenant guard awaits Railway redeploy.
          'x-org-id': process.env.PUBLIC_WEDGE_ORG_ID ?? 'demo-pilot-org-alpha',
        },
      },
      15_000,
    );

    if (upstream.status >= 500) {
      console.error(JSON.stringify({
        event: 'ingest_proxy_upstream_5xx',
        npi_prefix: `${cleanNpi.slice(0, 4)}······`,
        status: upstream.status,
      }));
      return await fallbackResponse(cleanNpi, 'upstream_5xx');
    }

    if (upstream.status >= 400) {
      console.error(JSON.stringify({
        event: 'ingest_proxy_upstream_4xx',
        npi_prefix: `${cleanNpi.slice(0, 4)}······`,
        status: upstream.status,
      }));
      return await fallbackResponse(cleanNpi, 'upstream_4xx');
    }

    let body: unknown = null;
    try {
      body = await upstream.json();
    } catch {
      console.error(JSON.stringify({
        event: 'ingest_proxy_non_json',
        npi_prefix: `${cleanNpi.slice(0, 4)}······`,
        status: upstream.status,
      }));
      return await fallbackResponse(cleanNpi, 'non_json');
    }

    return NextResponse.json(body ?? {}, { status: upstream.status });
  } catch (err) {
    const reason: UpstreamFailureReason =
      err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network';
    console.error(JSON.stringify({
      event: 'ingest_proxy_failure',
      reason,
      npi_prefix: `${cleanNpi.slice(0, 4)}······`,
    }));
    return await fallbackResponse(cleanNpi, reason);
  }
}
