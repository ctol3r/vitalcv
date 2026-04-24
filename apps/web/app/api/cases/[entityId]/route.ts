import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/case/${encodeURIComponent(entityId)}`,
      { cache: 'no-store' },
    );
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Case unavailable' }, { status: 502 });
  }
}
