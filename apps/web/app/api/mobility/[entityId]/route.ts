import { NextRequest, NextResponse } from 'next/server';
import {
  deriveMobilityOverview,
  projectEvidenceToGraph,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/mobility/[entityId] — per-entity mobility overview (Wave 270 / W230-C4).
 *
 * Leverages the evidence + trust pipeline (no new persistence, no ML, no ranking):
 * decision-grade licensed states, mobility trust, and reusable evidence count.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: public, NPI-keyed — reduce to publicly-disclosable evidence BEFORE
    // projecting, so a non-public node never exists. See graph-routes-public-disclosure.test.ts.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const trust = propagateTrust(projectEvidenceToGraph(collection));
    const overview = deriveMobilityOverview(collection, trust);
    return NextResponse.json(
      { schema: 'vitalcv.mobility.v1', ...overview },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[mobility/[entityId]]', error);
    const detail = 'Mobility overview failed.';
    return NextResponse.json(
      { error: 'mobility_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
