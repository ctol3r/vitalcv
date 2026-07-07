/**
 * POST /api/credentials/ingest
 *
 * Wave 238: Proxy to backend — ingests a parsed document into a CandidateCredential.
 * Body: { documentId: string }
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const session = await auth();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const body = await req.text();

  const res = await fetch(`${BACKEND_URL}/api/credentials/ingest`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
