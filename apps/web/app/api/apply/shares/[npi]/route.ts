import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/** GET /api/apply/shares/[npi] — list shares for a clinician */
export async function GET(req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const params = await context.params;
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k.startsWith('x-clerk-')) headers[k] = v;
  });
  const res = await fetch(`${B}/api/apply/shares/${params.npi}`, { headers });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
