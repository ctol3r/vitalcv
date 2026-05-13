/**
 * REPLAY-PERSIST-α — Web App Router proxy for replay chronology by lineage.
 *
 * GET /api/lineage/[lineageKey]/runs
 *   → 200 with { lineageKey, runs: [...] } sorted by checkedAt asc
 *   → 400 when lineageKey does not match `lin_v1_<16 hex>`
 *   → 200 with empty runs[] when no rows exist (chronology absence is
 *     not a 404 — the lineage is "no observations yet", not "missing")
 *   → 503 on upstream failure
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';

export const runtime = 'nodejs';

const LINEAGE_KEY_RE = /^lin_v1_[0-9a-f]{16}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ lineageKey: string }> },
) {
  const { lineageKey } = await context.params;

  if (!LINEAGE_KEY_RE.test(lineageKey)) {
    return NextResponse.json(
      { error: 'invalid_lineage_key', expected: 'lin_v1_<16 lowercase hex chars>' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${B}/api/replay/lineage/${lineageKey}/runs`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'invalid_upstream_payload' }, {
      status: res.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'lineage_runs_upstream_unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
