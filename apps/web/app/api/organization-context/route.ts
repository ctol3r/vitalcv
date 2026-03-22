import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['x-clerk-user-id'] = userId;
  const body = await req.text();
  const res = await fetch(`${B}/api/organization-context`, { method: 'POST', headers, body });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
