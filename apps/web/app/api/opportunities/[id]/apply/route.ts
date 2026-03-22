import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';
import { getPilotSurfaceControl, recordPilotServerEvent } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session.userId) {
    await recordPilotServerEvent({
      eventType: 'auth_failure',
      route: '/api/opportunities/:id/apply',
      session,
      severity: 'medium',
      message: 'Unauthorized request to apply endpoint.',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const control = await getPilotSurfaceControl('apply_flow');
  if (control && control.mode !== 'enabled') {
    return NextResponse.json({
      error: control.mode === 'degraded'
        ? 'Apply flow is temporarily limited while we stabilize launch traffic.'
        : 'Apply flow is temporarily unavailable.',
      control: {
        surfaceId: control.surfaceId,
        mode: control.mode,
        reason: control.reason,
      },
    }, { status: 503 });
  }

  const { id } = await params;
  const body = await req.text();
  try {
    const res = await fetch(`${MARKETPLACE_BACKEND}/api/opportunities/${id}/apply`, {
      method: 'POST',
      headers: buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    await recordPilotServerEvent({
      eventType: 'route_failure',
      route: '/api/opportunities/:id/apply',
      session,
      severity: 'high',
      message: 'Apply proxy failed to reach the backend.',
      entity: {
        kind: 'opportunity',
        id,
        label: id,
        objectType: 'opportunity',
      },
    });

    return NextResponse.json({
      error: 'Apply flow is temporarily unavailable.',
    }, { status: 503 });
  }
}
