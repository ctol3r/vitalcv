import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) await applyIdentityHeaders(headers, { userId });
  const body = await req.text();
  const res = await fetch(`${B}/api/organization-context`, { method: 'POST', headers, body });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
