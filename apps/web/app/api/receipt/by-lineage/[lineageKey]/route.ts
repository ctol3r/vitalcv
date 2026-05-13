/**
 * REPLAY-PERSIST-α — Receipt-derivation surface keyed by lineageKey.
 *
 * GET /api/receipt/by-lineage/[lineageKey]
 *   → 200 with the deterministic derivation payload for the most
 *     recent run on this lineage. Includes the canonical inputs
 *     (runId, entityId, channel, checkedAt, artifactChecksums,
 *     payloadDigest) + the derived `jti` (`receipt:${runId}`).
 *   → 400 when lineageKey does not match `lin_v1_<16 hex>`
 *   → 404 when no run exists for the lineage
 *   → 503 on upstream failure
 *
 * Path choice: `/api/receipt/by-lineage/[lineageKey]` rather than
 * `/api/receipt/[lineageKey]` because Next.js disallows two sibling
 * slug names at the same path level and `/api/receipt/[npi]` is the
 * adjacent identity-keyed receipt path (canonical receipts ship on a
 * separate PR). The `by-lineage/` segment makes the two paths
 * mountable without collision.
 *
 * Signing is out of scope for this α; the response is the
 * derivation-input payload that an upstream signer (or the
 * canonical signed-receipt endpoint when it ships) can convert
 * into a signed JWT with deterministic `jti`.
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
    const res = await fetch(`${B}/api/replay/lineage/${lineageKey}/receipt`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'invalid_upstream_payload' }, {
      status: res.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'lineage_receipt_upstream_unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
