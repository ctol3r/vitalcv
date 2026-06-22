import { NextRequest, NextResponse } from 'next/server';
import { projectEvidenceToGraph } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/graph/[entityId] — read-only evidence GraphProjection (Wave 221).
 *
 * Composes the passport runtime -> EvidenceCollection -> graph projection. No
 * new persistence, no graph database, no change to existing recruiter surfaces.
 * Trust is bounded by evidence status (no inflation, no false decision-grade).
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    const collection = passportToEvidenceCollection(passport);
    const projection = projectEvidenceToGraph(collection);

    return NextResponse.json(
      { schema: 'vitalcv.evidence-graph.v1', ...projection },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Graph projection failed.';
    return NextResponse.json(
      { error: 'graph_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
