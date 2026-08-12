import { NextRequest, NextResponse } from 'next/server';
import {
  projectEvidenceToGraph,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/timeline/[entityId] — read-only Professional Memory timeline (Wave 225).
 *
 * Composes passport runtime -> EvidenceCollection -> GraphProjection ->
 * TrustProjection -> TimelineProjection. The payload carries events,
 * trustHistory, recognition, and reputation, so the sub-views documented in
 * docs/wave225/C4-memory-api-contracts.md are filters over this single read.
 * No persistence, no ML, recruiter surfaces untouched.
 *
 * Recognition: employer acceptance is a protected employer-review concern. This
 * unauthenticated NPI response projects only the passport's public evidence and
 * does not read or merge acceptance history. Authorized employer readers retain
 * their separate, audited acceptance path.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // This is an unauthenticated NPI projection. Filter before graph or timeline
    // projection so non-public evidence cannot survive through derived events.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));

    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);
    const timeline = projectTimeline(collection, graph, trust);

    return NextResponse.json(
      { schema: 'vitalcv.timeline.v1', ...timeline },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[timeline/[entityId]]', error);
    const detail = 'Timeline projection failed.';
    return NextResponse.json(
      { error: 'timeline_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
