import { NextRequest, NextResponse } from 'next/server';
import { projectEvidenceToGraph, propagateTrust } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/graph/[entityId]/trust — read-only TrustProjection (Wave 222).
 *
 * Deterministic trust propagation over the evidence graph: passport runtime ->
 * EvidenceCollection -> GraphProjection -> TrustProjection. No ML, no persistence,
 * no change to recruiter surfaces. Trust is bounded by evidence (no inflation).
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

    return NextResponse.json(
      { schema: 'vitalcv.evidence-graph-trust.v1', ...trust },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Trust projection failed.';
    return NextResponse.json(
      { error: 'trust_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
