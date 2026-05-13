/**
 * REPLAY-PERSIST-α — Web App Router proxy for replay-run retrieval.
 *
 * GET /api/replay/[runId]
 *   → 200 with { run, events } when the row exists
 *   → 400 when runId does not match `run_v1_<16 hex>`
 *   → 404 when no row exists
 *   → 502/503 on upstream failure / shape mismatch
 *
 * Thin pass-through to the backend handler at /api/replay/runs/:runId.
 * No payload transformation; the backend already returns the
 * canonical shape (run + chronologically-ordered events).
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';

export const runtime = 'nodejs';

const RUN_ID_RE = /^run_v1_[0-9a-f]{16}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;

  if (!RUN_ID_RE.test(runId)) {
    return NextResponse.json(
      { error: 'invalid_run_id', expected: 'run_v1_<16 lowercase hex chars>' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${B}/api/replay/runs/${runId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'invalid_upstream_payload' }, {
      status: res.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'replay_run_upstream_unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
