import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';
import { recordPilotServerEvent } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    await recordPilotServerEvent({
      eventType: 'auth_failure',
      route: '/api/clinician/applications',
      session,
      severity: 'medium',
      message: 'Unauthorized request to clinician applications endpoint.',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${MARKETPLACE_BACKEND}/api/clinician/applications`, {
    headers: await buildMarketplaceHeaders(session),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
