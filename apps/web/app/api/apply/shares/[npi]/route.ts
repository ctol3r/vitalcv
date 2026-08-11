import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/**
 * GET /api/apply/shares/[npi] — list shares for a clinician.
 *
 * S1 — this proxy used to copy every inbound `x-clerk-*` header straight to the
 * backend:
 *
 *   req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
 *
 * `x-clerk-user-id` is a plain request header, so a browser (or curl) sets it to
 * whatever it likes and the proxy relayed the claim verbatim under this origin's
 * name. Identity is now derived server-side from the Clerk session and paired
 * with the bearer the backend verifies; nothing the caller sends is forwarded.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const headers = await buildIdentityHeaders({ userId: session.userId });

  const res = await fetch(`${B}/api/apply/shares/${encodeURIComponent(params.npi)}`, { headers });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
