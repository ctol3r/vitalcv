import { type NextRequest, NextResponse } from 'next/server';
import { fetchBackendJson } from '../../intelligence/_shared';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const { ok, status, payload } = await fetchBackendJson<unknown>('/api/findings/calibration');
  return NextResponse.json(payload, { status: ok ? 200 : status });
}
