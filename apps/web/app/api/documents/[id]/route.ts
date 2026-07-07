/**
 * GET /api/documents/[id]
 *
 * Proxy: forwards document lookup to backend.
 * Passes x-clerk-user-id header when available.
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  const headers = new Headers();
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const res = await fetch(`${BACKEND_URL}/api/documents/${id}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
