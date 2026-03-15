import { getApiBase } from '@/lib/api';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/system-health`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
