import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';

export const runtime = 'nodejs';

/**
 * Ingest proxy — Wave LIVE-100C P0-A rescue.
 *
 * Why this route exists:
 *   The homepage hero POSTs `/api/ingest/<npi>` to kick off the
 *   source-backed readiness pipeline. When the upstream backend is
 *   unreachable, slow, or returning 5xx (common during Railway
 *   redeploys, tenant-guard rollouts, or source outages), the old
 *   proxy bubbled the 5xx straight back to the browser and the
 *   homepage dead-ended. That is a production blocker.
 *
 * Truth rules preserved by the fallback:
 *   - `unavailable` is a source state, not a clinician fault.
 *     Upstream outage ≠ clinician defect.
 *   - `access_required` is surfaced when the upstream hints the
 *     source needs institutional access (e.g., Nursys, FSMB). Not a
 *     clinician fault either.
 *   - `pending` means we have not yet finished the check (or the
 *     proxy is returning before the real backend responds).
 *   - `stale` means a prior check has aged past its freshness window.
 *   - No lane is ever returned as `verified` by the fallback. The
 *     fallback cannot and does not substitute for a real source check.
 *
 * Logging rule:
 *   - Server errors are logged server-side only (`console.error`),
 *     never echoed to the client with stack traces / backend URLs /
 *     header material. Client gets a neutral, bounded JSON shape.
 */

const FALLBACK_LANES = [
  { source: 'NPPES', state: 'pending', detail: 'Identity check pending upstream response.' },
  { source: 'OIG_LEIE', state: 'pending', detail: 'Federal exclusion check pending upstream response.' },
  { source: 'PECOS_PUBLIC', state: 'pending', detail: 'Medicare public enrollment posture pending.' },
  { source: 'STATE_BOARD', state: 'access_required', detail: 'State board lane requires institutional access; not a clinician defect.' },
] as const;

type UpstreamFailureReason = 'timeout' | 'network' | 'non_json' | 'upstream_5xx' | 'upstream_4xx';

interface FallbackBody {
  ok: false;
  fallback: true;
  reason: UpstreamFailureReason;
  npi: string;
  runId: null;
  lanes: typeof FALLBACK_LANES;
  message: string;
  /**
   * Explicit truth-preservation notes so UI callers don't have to
   * re-interpret the shape.
   */
  truth: {
    unavailable_is_not_blocked: true;
    access_required_is_not_clinician_fault: true;
    unknown_is_not_negative: true;
  };
}

function fallbackResponse(
  npi: string,
  reason: UpstreamFailureReason,
  httpStatus: number,
): NextResponse {
  const body: FallbackBody = {
    ok: false,
    fallback: true,
    reason,
    npi,
    runId: null,
    lanes: FALLBACK_LANES,
    message:
      reason === 'timeout'
        ? 'The readiness pipeline timed out. Source checks will retry; try again in a moment.'
        : reason === 'network'
          ? 'The readiness pipeline is temporarily unreachable. Source checks will retry.'
          : reason === 'non_json'
            ? 'The readiness pipeline returned an unexpected response. Source checks are queued to retry.'
            : reason === 'upstream_4xx'
              ? 'The readiness request was refused upstream. No source check was performed against this NPI.'
              : 'The readiness pipeline is temporarily degraded. Source checks are queued.',
    truth: {
      unavailable_is_not_blocked: true,
      access_required_is_not_clinician_fault: true,
      unknown_is_not_negative: true,
    },
  };
  // Always return 200 from this proxy on soft-failure paths. The body
  // carries `fallback: true` + `reason` so the client can distinguish a
  // real response from a degraded one without having to branch on HTTP
  // status codes. HTTP 200 keeps the homepage from dead-ending.
  void httpStatus;
  return NextResponse.json(body, { status: 200 });
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
          // Public wedge org context — required while backend tenant
          // guard awaits Railway redeploy.
          'x-org-id': process.env.PUBLIC_WEDGE_ORG_ID ?? 'demo-pilot-org-alpha',
        },
      },
      15_000,
    );

    if (upstream.status >= 500) {
      console.error(
        JSON.stringify({
          event: 'ingest_proxy_upstream_5xx',
          npi_prefix: cleanNpi.slice(0, 4) + '······',
          status: upstream.status,
        }),
      );
      return fallbackResponse(cleanNpi, 'upstream_5xx', upstream.status);
    }

    if (upstream.status >= 400) {
      console.error(
        JSON.stringify({
          event: 'ingest_proxy_upstream_4xx',
          npi_prefix: cleanNpi.slice(0, 4) + '······',
          status: upstream.status,
        }),
      );
      return fallbackResponse(cleanNpi, 'upstream_4xx', upstream.status);
    }

    let body: unknown = null;
    try {
      body = await upstream.json();
    } catch {
      console.error(
        JSON.stringify({
          event: 'ingest_proxy_non_json',
          npi_prefix: cleanNpi.slice(0, 4) + '······',
          status: upstream.status,
        }),
      );
      return fallbackResponse(cleanNpi, 'non_json', upstream.status);
    }

    return NextResponse.json(body ?? {}, { status: upstream.status });
  } catch (err) {
    const reason: UpstreamFailureReason =
      err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network';
    console.error(
      JSON.stringify({
        event: 'ingest_proxy_failure',
        reason,
        npi_prefix: cleanNpi.slice(0, 4) + '······',
        // Intentionally do NOT log err.message — it may contain
        // backend host info that should not ship with client traces.
      }),
    );
    return fallbackResponse(cleanNpi, reason, 502);
  }
}
