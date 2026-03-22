import { type NextRequest, NextResponse } from 'next/server';
import { forwardPilotOpsRequest } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const response = await forwardPilotOpsRequest(`/api/internal/pilot-ops/queue/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: await req.text(),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
