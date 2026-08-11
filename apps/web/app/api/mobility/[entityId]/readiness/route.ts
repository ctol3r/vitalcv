import { NextRequest, NextResponse } from 'next/server';
import {
  defaultReadinessTemplate,
  detectGaps,
  projectEvidenceToGraph,
  projectReadiness,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/** Whitelist the optional state param so it can never inject into anything downstream. */
function safeState(value: string | null): string | undefined {
  return value && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : undefined;
}

/**
 * GET /api/mobility/[entityId]/readiness?state=XX — Ready/Near Ready/Blocked/Unknown
 * against the STANDARD readiness template (Wave 270 / W230-C5). Not employer-opportunity
 * matching (that is W260) — a deterministic per-entity readiness verdict.
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
    const opportunity = defaultReadinessTemplate(state);
    const readiness = projectReadiness(opportunity, detectGaps(opportunity, collection, trust), trust);
    return NextResponse.json(
      { schema: 'vitalcv.mobility-readiness.v1', ...readiness },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[mobility/[entityId]/readiness]', error);
    const detail = 'Mobility readiness failed.';
    return NextResponse.json(
      { error: 'mobility_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
