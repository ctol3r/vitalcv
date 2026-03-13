/**
 * Wave 246: Apply-with-VitalCV — POST /api/apply/bundle proxy
 */
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  req.headers.forEach((v, k) => {
    if (k.startsWith('x-clerk-')) headers[k] = v;
  });
  const body = await req.text();
  const res = await fetch(`${B}/api/apply/bundle`, {
    method: 'POST',
    headers,
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
