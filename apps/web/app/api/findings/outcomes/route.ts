import { type NextRequest, NextResponse } from 'next/server';
import { fetchBackendJson } from '../../intelligence/_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get('limit');
  const investigatorId = req.nextUrl.searchParams.get('investigatorId');
  if (limit) params.set('limit', limit);
  if (investigatorId) params.set('investigatorId', investigatorId);

  const { ok, status, payload } = await fetchBackendJson<unknown>(
    '/api/findings/outcomes',
    params.toString() ? params : undefined,
  );
  return NextResponse.json(payload, { status: ok ? 200 : status });
}
