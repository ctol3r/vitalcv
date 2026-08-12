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
 * POST /api/apply/share — Sign & Share with organization context.
 *
 * S1 — see app/api/apply/shares/[npi]/route.ts for the defect this closes. The
 * inbound `x-clerk-*` copy loop is gone: a share discloses a clinician's
 * compiled evidence, so the acting identity may not be asserted by the caller.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await buildIdentityHeaders({ userId: session.userId })),
  };

  const body = await req.text();
  const res = await fetch(`${B}/api/apply/share`, {
    method: 'POST',
    headers,
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
