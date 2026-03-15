import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/provider-intelligence/${npi}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
