import { NextRequest, NextResponse } from 'next/server';
import {
  deriveMobilityOverview,
  generateIntelligence,
  projectEvidenceToGraph,
  projectOrganizations,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/career-intelligence/[entityId] — deterministic, explainable career
 * intelligence (Wave 320): insights, notifications, prioritized actions, derived
 * over the evidence/trust/timeline/mobility/organization projections. No ML, no
 * persistence. Namespaced as `career-intelligence` to stay clear of the
 * pre-existing investigation `/api/intelligence/*` system.
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
    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);
    const timeline = projectTimeline(collection, graph, trust);
    const mobility = deriveMobilityOverview(collection, trust);
    const organizations = projectOrganizations(collection, graph);
    const intelligence = generateIntelligence(collection, trust, timeline, mobility, organizations);
    return NextResponse.json(
      { schema: 'vitalcv.career-intelligence.v1', ...intelligence },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[career-intelligence/[entityId]]', error);
    const detail = 'Career intelligence failed.';
    return NextResponse.json(
      { error: 'career_intelligence_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
