import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND = getApiBase();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Copilot proxy failed' }, { status: 502 });
  }
}
