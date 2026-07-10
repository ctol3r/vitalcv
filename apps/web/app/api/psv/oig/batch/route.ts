/**
 * Wave 241 — OIG/LEIE Batch Exclusion Check proxy
 * POST /api/psv/oig/batch
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${B}/api/psv/oig/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await buildIdentityHeaders({ userId: session.userId })),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to perform OIG LEIE batch check' }, { status: 502 });
  }
}
