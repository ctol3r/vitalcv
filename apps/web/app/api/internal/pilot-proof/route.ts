import { type NextRequest, NextResponse } from 'next/server';
import { forwardPilotOpsRequest } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search;
  const response = await forwardPilotOpsRequest(`/api/internal/pilot-proof${search}`, {
    method: 'GET',
  });

  const contentType = response.headers.get('content-type') ?? 'application/json';

  if (contentType.includes('text/csv')) {
    const csv = await response.text();
    return new NextResponse(csv, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment; filename="vitalcv-pilot-proof.csv"',
      },
    });
  }

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
