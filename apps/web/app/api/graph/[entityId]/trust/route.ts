import { NextRequest, NextResponse } from 'next/server';
import { projectEvidenceToGraph, propagateTrust } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/graph/[entityId]/trust — read-only TrustProjection (Wave 222).
 *
 * Deterministic trust propagation over the evidence graph: passport runtime ->
 * EvidenceCollection -> GraphProjection -> TrustProjection. No ML, no persistence,
 * no change to recruiter surfaces. Trust is bounded by evidence (no inflation).
 *
 * PUBLIC AND UNAUTHENTICATED, and NPI-keyed, so what it may return is governed by
 * ADR 0006 and enforced by `toPublicEvidenceCollection` — non-public evidence is
 * removed BEFORE projection, so it contributes no node, no edge, and no trust
 * dimension. A per-dimension score computed over non-public evidence would leak
 * that evidence's existence even without naming it, which is why the filter runs
 * on the collection rather than on the response. See
 * `graph-routes-public-disclosure.test.ts`.
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
    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);

    return NextResponse.json(
      { schema: 'vitalcv.evidence-graph-trust.v1', ...trust },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[graph/[entityId]/trust]', error);
    const detail = 'Trust projection failed.';
    return NextResponse.json(
      { error: 'trust_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
