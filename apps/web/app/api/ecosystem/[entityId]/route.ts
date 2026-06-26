import { NextRequest, NextResponse } from 'next/server';
import {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  generateIntelligence,
  projectEvidenceToGraph,
  projectOrganizations,
  projectReadiness,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/ecosystem/[entityId] — composite ecosystem snapshot (Wave 400, C1 perf).
 *
 * Resolves the passport ONCE and runs the whole pipeline a single time, returning
 * every projection in one response. The ecosystem dashboard previously fired six
 * separate API calls — each re-resolving the passport — so this collapses 6×
 * passport resolution + 6 round-trips into 1. Same honest, source-backed data.
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
    const mobility = deriveMobilityOverview(collection, trust);
    const template = defaultReadinessTemplate();
    const readiness = projectReadiness(template, detectGaps(template, collection, trust), trust);
    const organizations = projectOrganizations(collection, graph);
    const intelligence = generateIntelligence(collection, trust, timeline, mobility, organizations);

    return NextResponse.json(
      { schema: 'vitalcv.ecosystem.v1', subjectKey: collection.subjectKey, evidence: collection, trust, timeline, mobility, readiness, organizations, intelligence },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Ecosystem snapshot failed.';
    return NextResponse.json(
      { error: 'ecosystem_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
