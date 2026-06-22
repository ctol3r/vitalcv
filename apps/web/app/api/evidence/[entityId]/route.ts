import { NextRequest, NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

/**
 * GET /api/evidence/[entityId] — read-only EvidenceCollection (Wave 220).
 *
 * Composes the existing passport runtime into the canonical evidence facade
 * (@vitalcv/domain-evidence). Additive and read-only: does not touch the
 * passport, packet, or employer-review surfaces. Status is verbatim from source
 * coverage, so gated/stale evidence is never presented as decision-grade.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    const collection = passportToEvidenceCollection(passport);

    return NextResponse.json(
      { schema: 'vitalcv.evidence-collection.v1', ...collection },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Evidence collection failed.';
    return NextResponse.json(
      { error: 'evidence_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
