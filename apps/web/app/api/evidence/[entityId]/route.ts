import { NextRequest, NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/evidence/[entityId] — read-only EvidenceCollection (Wave 220).
 *
 * Composes the existing passport runtime into the canonical evidence facade
 * (@vitalcv/domain-evidence). Additive and read-only: does not touch the
 * passport, packet, or employer-review surfaces. Status is verbatim from source
 * coverage, so gated/stale evidence is never presented as decision-grade.
 *
 * PUBLIC AND UNAUTHENTICATED — declared `visibility: 'public'` in
 * lib/platform/contract.ts — so ADR 0006 governs it, and this is the most direct
 * exposure of the whole chain: it returns the evidence objects THEMSELVES, each
 * carrying `evidenceClass` verbatim, with no projection in between. The graph
 * routes' original justification was that their contents are "already public via
 * /verify/:npi and /api/evidence"; that argument only holds while /api/evidence
 * is itself bounded, which is what `toPublicEvidenceCollection` does here.
 * Covered by `evidence-route-public-disclosure.test.ts`.
 *
 * An authenticated surface that legitimately needs the full collection (an
 * employer-evidence lane, say) must be a separate authorized route — not this one
 * widened, which is the failure mode ADR 0006's Consequences section names.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: reduce to publicly-disclosable evidence before serving.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));

    return NextResponse.json(
      { schema: 'vitalcv.evidence-collection.v1', ...collection },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[evidence/[entityId]]', error);
    const detail = 'Evidence collection failed.';
    return NextResponse.json(
      { error: 'evidence_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
