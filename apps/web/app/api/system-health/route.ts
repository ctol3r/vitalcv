import { NextResponse } from 'next/server';
import { buildForwardHeaders, decorateAuthFailurePayload } from '../intelligence/_shared';

export const runtime = 'nodejs';

const FALLBACK_BACKEND = 'http://localhost:4000';

function backendUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    FALLBACK_BACKEND
  );
}

export async function GET() {
  const base = backendUrl();
  try {
    const res = await fetch(`${base}/api/system-health`, {
      headers: await buildForwardHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[api/system-health] proxy failed', { error: message, backend: base });
    return NextResponse.json({ error: 'backend_unavailable', error_description: message }, { status: 502 });
  }
}
