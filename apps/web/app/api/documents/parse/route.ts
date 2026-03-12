/**
 * POST /api/documents/parse
 *
 * Proxy: forwards multipart file upload to backend document parser.
 * Passes x-clerk-user-id header when available.
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const session = await auth();

  const headers = new Headers();
  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  // Forward raw multipart body — do NOT set Content-Type (browser must set boundary)
  const body = await req.arrayBuffer();
  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const res = await fetch(`${BACKEND_URL}/api/documents/parse`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
