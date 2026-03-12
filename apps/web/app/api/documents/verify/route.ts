/**
 * POST /api/documents/verify
 *
 * Proxy: forwards verification request to backend.
 * Passes x-clerk-user-id header when available.
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.text();

  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  const res = await fetch(`${BACKEND_URL}/api/documents/verify`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
