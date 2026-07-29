import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import { getPilotSurfaceControl, recordPilotServerEvent } from '@/lib/server/pilot-ops';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
const B = getBackendBase();

function controlPayload(control: Awaited<ReturnType<typeof getPilotSurfaceControl>>) {
  return control
    ? {
        surfaceId: control.surfaceId,
        mode: control.mode,
        reason: control.reason,
      }
    : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const control = await getPilotSurfaceControl('explore_board');
  // The board is deliberately public. Clerk enriches a signed-in request for
  // the private MATCHA comparison, but a missing or locally unavailable Clerk
  // middleware must never turn anonymous browsing into a 500.
  const session = await auth().catch(() => null);

  if (control && (control.mode === 'disabled' || control.mode === 'hidden')) {
    return NextResponse.json({
      opportunities: [],
      total: 0,
      control: controlPayload(control),
    });
  }

  try {
    const res = await fetch(`${B}/api/opportunities${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      headers: await buildMarketplaceHeaders(session),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (control?.mode === 'degraded') {
      return NextResponse.json({
        ...payload,
        control: controlPayload(control),
      }, { status: res.status });
    }

    return NextResponse.json(payload, { status: res.status });
  } catch {
    await recordPilotServerEvent({
      eventType: 'route_failure',
      route: '/api/opportunities',
      severity: 'high',
      message: 'Explore opportunities proxy failed to reach the backend.',
    });

    return NextResponse.json({
      error: 'Opportunity feed is temporarily unavailable.',
      control: controlPayload(control),
    }, { status: 503 });
  }
}
