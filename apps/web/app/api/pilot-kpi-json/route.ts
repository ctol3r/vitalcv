import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';

export const runtime = 'nodejs';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

function appendScopeParams(source: URLSearchParams, target: URLSearchParams): void {
  const orgContextId = source.get('orgContextId') ?? source.get('org');
  const pilotId = source.get('pilotId');
  const workflowLane = source.get('workflowLane') ?? source.get('lane');

  if (orgContextId) {
    target.set('orgContextId', orgContextId);
  }
  if (pilotId) {
    target.set('pilotId', pilotId);
  }
  if (workflowLane) {
    target.set('workflowLane', workflowLane);
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!MONITORING_SECRET) {
    return NextResponse.json({ error: 'MONITORING_SECRET not configured.' }, { status: 500 });
  }

  const params = new URLSearchParams();
  params.set('days', req.nextUrl.searchParams.get('days') ?? '90');
  appendScopeParams(req.nextUrl.searchParams, params);

  try {
    const upstream = await fetch(`${getBackendBase()}/api/internal/pilot/kpis?${params.toString()}`, {
      headers: { 'x-monitoring-secret': MONITORING_SECRET },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || !payload) {
      const error = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'KPI export failed.';

      return NextResponse.json({ error }, { status: upstream.status === 400 ? 400 : 500 });
    }

    const filename = `vitalcv-pilot-kpis-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable.' }, { status: 500 });
  }
}
