/**
 * GET /api/audit/[eventId]/graph
 *
 * Matuschak Lineage Graph API (WAVE C72).
 *
 * Returns a typed `LineageGraph` payload for a single audit event,
 * resolving:
 *   - upstream parents (DAG ancestors via parentEventIds)
 *   - downstream children (events that name this event as a parent)
 *   - siblings (events sharing the same runId OR lineageKey)
 *
 * Reads from `apps/web/lib/audit/demoEvents.ts` (in-memory JSON stub)
 * per the wave constraint "do not touch production databases".
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDemoAuditEvents } from '@/lib/audit/demoEvents';
import { resolveLineageGraph } from '@/lib/audit/lineageGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { eventId } = await context.params;
  if (!eventId || !/^[A-Za-z0-9_-]+$/.test(eventId)) {
    return NextResponse.json(
      { error: 'invalid_event_id_format' },
      { status: 400 },
    );
  }

  const graph = resolveLineageGraph(eventId, listDemoAuditEvents());
  if (!graph) {
    return NextResponse.json(
      { error: 'audit_event_not_found', eventId },
      { status: 404 },
    );
  }

  return NextResponse.json(graph, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
