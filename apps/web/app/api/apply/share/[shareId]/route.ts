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
 * DELETE /api/apply/share/[shareId] — revoke a share.
 *
 * S1 — see app/api/apply/shares/[npi]/route.ts. Revocation is a mutation on
 * someone's disclosure record; the caller does not get to name who is revoking.
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ shareId: string }> }) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const headers = await buildIdentityHeaders({ userId: session.userId });

  const res = await fetch(`${B}/api/apply/share/${encodeURIComponent(params.shareId)}`, {
    method: 'DELETE',
    headers,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
