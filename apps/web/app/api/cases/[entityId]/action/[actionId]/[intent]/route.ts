import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string; actionId: string; intent: string }> },
) {
  const { entityId, actionId, intent } = await params;

  if (intent !== 'start' && intent !== 'complete') {
    return NextResponse.json({ error: 'intent must be start or complete' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const url = `${BACKEND_URL}/api/case/${encodeURIComponent(entityId)}/action/${encodeURIComponent(actionId)}/${intent}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const responseBody = await res.json().catch(() => ({}));
    return NextResponse.json(responseBody, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 502 });
  }
}
