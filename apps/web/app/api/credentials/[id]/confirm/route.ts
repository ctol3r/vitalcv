/**
 * PATCH /api/credentials/[id]/confirm
 *
 * Wave 238: Proxy to backend — confirms a CandidateCredential with optional field corrections.
 * Body: { corrections: Record<string, string> }
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  const body = await req.text();

  const res = await fetch(`${BACKEND_URL}/api/credentials/${encodeURIComponent(id)}/confirm`, {
    method: 'PATCH',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
