import { type NextRequest, NextResponse } from 'next/server';
import { forwardPilotOpsRequest } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search;
  const response = await forwardPilotOpsRequest(`/api/internal/pilot-ops${search}`, {
    method: 'GET',
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
