import { type NextRequest, NextResponse } from 'next/server';
import { fetchBackendJson } from '../../intelligence/_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const params = new URLSearchParams();

  const npi = searchParams.get('npi');
  const findingId = searchParams.get('findingId');
  const storylineId = searchParams.get('storylineId');

  if (npi) params.set('npi', npi);
  if (findingId) params.set('findingId', findingId);
  if (storylineId) params.set('storylineId', storylineId);

  if (!npi && !findingId && !storylineId) {
    return NextResponse.json(
      { error: 'At least one anchor (npi, findingId, storylineId) is required' },
      { status: 400 },
    );
  }

  const { ok, status, payload } = await fetchBackendJson<unknown>(
    '/api/investigation/workbench',
    params,
  );

  return NextResponse.json(payload, { status: ok ? 200 : status });
}
