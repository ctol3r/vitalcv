import { NextRequest, NextResponse } from 'next/server';
import { projectEvidenceToGraph } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/graph/[entityId] — read-only evidence GraphProjection (Wave 221).
 *
 * Composes the passport runtime -> EvidenceCollection -> graph projection. No
 * new persistence, no graph database, no change to existing recruiter surfaces.
 * Trust is bounded by evidence status (no inflation, no false decision-grade).
 *
 * PUBLIC AND UNAUTHENTICATED, and NPI-keyed, so what it may return is governed by
 * ADR 0006 and enforced by `toPublicEvidenceCollection` — non-public evidence is
 * removed BEFORE projection, so its nodes and edges never exist. Do not move that
 * call after the projection and do not project the unfiltered collection here:
 * `graph-routes-public-disclosure.test.ts` fails if either happens.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: reduce to publicly-disclosable evidence BEFORE projecting.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const projection = projectEvidenceToGraph(collection);

    return NextResponse.json(
      { schema: 'vitalcv.evidence-graph.v1', ...projection },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[graph/[entityId]]', error);
    const detail = 'Graph projection failed.';
    return NextResponse.json(
      { error: 'graph_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
