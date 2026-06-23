import { NextRequest, NextResponse } from 'next/server';
import { projectEvidenceToGraph, projectOrganizations } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/organizations/[entityId] — the clinician's organization graph (Wave 265).
 *
 * Projects the organizations backing the clinician's evidence (training
 * institutions, credential issuers, licensing boards, verification authorities)
 * and the typed clinician↔organization relationships. Read-only, no persistence,
 * leverages the evidence/graph pipeline. Trust contribution is bounded (no inflation).
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
    const organizations = projectOrganizations(collection, graph);
    return NextResponse.json(
      { schema: 'vitalcv.organizations.v1', ...organizations },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Organization graph failed.';
    return NextResponse.json(
      { error: 'organizations_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
