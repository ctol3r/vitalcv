import { NextRequest, NextResponse } from 'next/server';
import {
  defaultReadinessTemplate,
  detectGaps,
  projectEvidenceToGraph,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

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
    const collection = passportToEvidenceCollection(passport);
    const trust = propagateTrust(projectEvidenceToGraph(collection));
    const report = detectGaps(defaultReadinessTemplate(state), collection, trust);
    return NextResponse.json(
      { schema: 'vitalcv.mobility-gaps.v1', ...report },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Mobility gaps failed.';
    return NextResponse.json(
      { error: 'mobility_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
