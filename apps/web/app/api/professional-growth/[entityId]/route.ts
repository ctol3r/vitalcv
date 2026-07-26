import { NextRequest, NextResponse } from 'next/server';
import {
  projectEvidenceToGraph,
  projectProfessionalGrowth,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/professional-growth/[entityId] — Professional Growth (Wave 520):
 * milestones, career progression, growth gaps, and mentorship model, derived over
 * the evidence/trust/timeline projections. Read-only; deterministic; mentorship
 * data is external (empty here). No new architecture.
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
    const growth = projectProfessionalGrowth(collection, trust, timeline);
    return NextResponse.json(
      { schema: 'vitalcv.professional-growth.v1', ...growth },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Professional growth failed.';
    return NextResponse.json(
      { error: 'professional_growth_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
