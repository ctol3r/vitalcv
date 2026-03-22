/**
 * /api/webauthn/authenticate-options — proxy to Express backend
 * GET → backend GET /api/webauthn/authenticate-options
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  const sessionId = req.headers.get('x-session-id') ?? undefined;
  const headers: Record<string, string> = {};
  if (sessionId) headers['x-session-id'] = sessionId;

  const res = await fetch(`${B}/api/webauthn/authenticate-options`, { headers });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
