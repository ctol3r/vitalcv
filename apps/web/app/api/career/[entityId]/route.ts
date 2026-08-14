import { NextRequest, NextResponse } from 'next/server';
import { composeCareerModel } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

/**
 * GET /api/career/[entityId] — the canonical Career Model (Wave 1000, C1/C4).
 *
 * One passport resolve → one `composeCareerModel` pipeline → one response that
 * every product (Career OS, Recruiter OS, Organization OS) consumes. This is the
 * single source of truth; no surface re-orchestrates the projections itself.
 *
 * Smart caching (C4): the model carries a deterministic `meta.contentHash` over
 * the decision-relevant evidence. We return it as a (weak) ETag; a client that
 * sends a matching `If-None-Match` gets `304 Not Modified` — revalidation
 * without ever serving stale trust data (the body stays `no-store`).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: public, NPI-keyed — reduce to publicly-disclosable evidence BEFORE
    // projecting, so a non-public node never exists. See graph-routes-public-disclosure.test.ts.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const model = composeCareerModel(collection);

    const etag = `W/"${model.meta.contentHash}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json(model, {
      status: 200,
      headers: { ETag: etag, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[career/[entityId]]', error);
    const detail = 'Career model unavailable.';
    return NextResponse.json(
      { error: 'career_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
