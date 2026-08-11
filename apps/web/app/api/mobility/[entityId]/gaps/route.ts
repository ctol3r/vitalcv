import { NextRequest, NextResponse } from 'next/server';
import {
  defaultReadinessTemplate,
  detectGaps,
  projectEvidenceToGraph,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

function safeState(value: string | null): string | undefined {
  return value && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : undefined;
}

/**
 * GET /api/mobility/[entityId]/gaps?state=XX — the GapReport against the standard
 * readiness template (Wave 270 / W230-C3). Honest missing/insufficient/stale kinds.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  const state = safeState(req.nextUrl.searchParams.get('state'));
  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: public, NPI-keyed — reduce to publicly-disclosable evidence BEFORE
    // projecting, so a non-public node never exists. See graph-routes-public-disclosure.test.ts.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const trust = propagateTrust(projectEvidenceToGraph(collection));
    const report = detectGaps(defaultReadinessTemplate(state), collection, trust);
    return NextResponse.json(
      { schema: 'vitalcv.mobility-gaps.v1', ...report },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[mobility/[entityId]/gaps]', error);
    const detail = 'Mobility gaps failed.';
    return NextResponse.json(
      { error: 'mobility_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
