import { NextRequest, NextResponse } from 'next/server';
import {
  buildEvidenceCollection,
  projectEvidenceToGraph,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { BACKEND_URL } from '@/lib/backend-url';
import {
  acceptanceHistoryToEvidenceObjects,
  fetchAcceptanceHistoryForTimeline,
} from '@/lib/recognition/acceptance-evidence';

export const runtime = 'nodejs';

const NPI_PATTERN = /^\d{10}$/;

/**
 * GET /api/timeline/[entityId] — read-only Professional Memory timeline (Wave 225).
 *
 * Composes passport runtime -> EvidenceCollection -> GraphProjection ->
 * TrustProjection -> TimelineProjection. The payload carries events,
 * trustHistory, recognition, and reputation, so the sub-views documented in
 * docs/wave225/C4-memory-api-contracts.md are filters over this single read.
 * No persistence, no ML, recruiter surfaces untouched.
 *
 * Recognition: for NPI subjects, recorded employer acceptances (the canonical
 * Recognition → Acceptance → Start middle step) are merged in as
 * acceptance-class evidence before projection, so they appear as career
 * events with recognitionImpact 'acceptance'. If the acceptance read fails,
 * the timeline projects without them — honest omission, never fabrication.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const [passport, acceptanceHistory] = await Promise.all([
      resolvePassportRuntimePassport(entityId),
      NPI_PATTERN.test(entityId.trim())
        ? fetchAcceptanceHistoryForTimeline(BACKEND_URL, entityId.trim())
        : Promise.resolve(null),
    ]);

    let collection = passportToEvidenceCollection(passport);

    if (acceptanceHistory) {
      const acceptance = acceptanceHistoryToEvidenceObjects(entityId.trim(), acceptanceHistory);
      collection = buildEvidenceCollection({
        subjectKey: collection.subjectKey,
        generatedFor: collection.generatedFor,
        objects: [...collection.objects, ...acceptance.objects],
        relationships: [...collection.relationships, ...acceptance.relationships],
      });
    }

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
