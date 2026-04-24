import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params;
  const upstream = await fetch(`${BACKEND_URL}/api/decision/${entityId}`, {
    cache: 'no-store',
  });
  const body = await upstream.json();
  return NextResponse.json(body, { status: upstream.status });
}
