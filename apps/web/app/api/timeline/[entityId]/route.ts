import { NextRequest, NextResponse } from 'next/server';
import {
  projectEvidenceToGraph,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/timeline/[entityId] — read-only Professional Memory timeline (Wave 225).
 *
 * Composes passport runtime -> EvidenceCollection -> GraphProjection ->
 * TrustProjection -> TimelineProjection. The payload carries events,
 * trustHistory, recognition, and reputation, so the sub-views documented in
 * docs/wave225/C4-memory-api-contracts.md are filters over this single read.
 * No persistence, no ML, recruiter surfaces untouched.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    const collection = passportToEvidenceCollection(passport);
    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);
    const timeline = projectTimeline(collection, graph, trust);

    return NextResponse.json(
      { schema: 'vitalcv.timeline.v1', ...timeline },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Timeline projection failed.';
    return NextResponse.json(
      { error: 'timeline_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
