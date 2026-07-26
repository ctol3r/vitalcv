/**
 * Wave 241 — OIG/LEIE Exclusion Check proxy
 * GET /api/psv/oig/check/:npi
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { npi } = await context.params;

  try {
    const res = await fetch(`${B}/api/psv/oig/check/${npi}`, {
      headers: { ...(await buildIdentityHeaders({ userId: session.userId })) },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to perform OIG LEIE check' }, { status: 502 });
  }
}
