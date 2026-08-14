import { NextRequest, NextResponse } from 'next/server';
import { composeCareerModel } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/ecosystem/[entityId] — composite ecosystem snapshot (Wave 400, C1 perf).
 *
 * Resolves the passport ONCE and runs the whole pipeline a single time, returning
 * every projection in one response. The ecosystem dashboard previously fired six
 * separate API calls — each re-resolving the passport — so this collapses 6×
 * passport resolution + 6 round-trips into 1. Same honest, source-backed data.
 *
 * Wave 1000 (C2/C5): orchestration now delegates to the canonical
 * `composeCareerModel` — the one Career projection layer. This route only
 * re-shapes that model into the established `vitalcv.ecosystem.v1` contract, so
 * the ecosystem surface and the Career Model can never drift apart.
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
    const model = composeCareerModel(collection);

    return NextResponse.json(
      {
        schema: 'vitalcv.ecosystem.v1',
        subjectKey: model.identity.subjectKey,
        evidence: model.evidence,
        trust: model.trust,
        timeline: model.timeline,
        mobility: model.mobility,
        readiness: model.readiness,
        organizations: model.organizations,
        intelligence: model.intelligence,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[ecosystem/[entityId]]', error);
    const detail = 'Ecosystem snapshot failed.';
    return NextResponse.json(
      { error: 'ecosystem_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
