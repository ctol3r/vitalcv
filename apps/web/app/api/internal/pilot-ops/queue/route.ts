import { type NextRequest, NextResponse } from 'next/server';
import { forwardPilotOpsRequest } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const response = await forwardPilotOpsRequest('/api/internal/pilot-ops/queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: await req.text(),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
