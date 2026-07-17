import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

/**
 * POST /api/verifier/accept — server-side proxy to the backend credential-
 * presentation acceptance route (a verifier *mutation*).
 *
 * This proxy exists so the caller's org-role reaches the backend from a trusted
 * source: buildMarketplaceHeaders derives `x-org-role` from the verified Clerk
 * session's `org_role` claim (never a client-supplied value), which feeds the
 * backend `requireOrgRole` guard. A browser calling the backend directly could
 * only supply a spoofable header, so verifier UI must go through here.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.text();
  const res = await fetch(`${MARKETPLACE_BACKEND}/api/verifier/accept`, {
    method: 'POST',
    headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
