import { NextRequest, NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { buildEvidenceExchange } from '@/lib/exchange/exchange';
import { authorizeIssuer } from '@/lib/exchange/federation';
import { demoFederation, exchangeSecret } from '@/lib/exchange/config';

export const runtime = 'nodejs';

/**
 * POST /api/exchange/issue — Issuer API (Wave 800, C1).
 *
 * Body: `{ entityId: string, issuer: string, issuedAt?: ISO-8601 }`.
 *
 * Resolves the clinician's source-backed EvidenceCollection and packages it into
 * a signed `EvidenceExchange`. Gated at the federation boundary: a non-member or
 * a member without the `issuer` role is refused (403). No trust score is placed
 * in the envelope — only signed evidence the receiver re-evaluates itself.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { entityId?: unknown; issuer?: unknown; issuedAt?: unknown }
      | null;

    const entityId = typeof body?.entityId === 'string' ? body.entityId.trim() : '';
    const issuer = typeof body?.issuer === 'string' ? body.issuer.trim() : '';
    if (!entityId || !issuer) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'entityId and issuer are required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Federation authorization (membership + role) before any evidence work.
    const auth = authorizeIssuer(demoFederation(), issuer);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'issuer_not_authorized', error_description: auth.reason },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // issuedAt is caller-supplied for determinism/replay context; default to now.
    const issuedAt =
      typeof body?.issuedAt === 'string' && body.issuedAt.trim()
        ? body.issuedAt.trim()
        : new Date().toISOString();

    const passport = await resolvePassportRuntimePassport(entityId);
    const collection = passportToEvidenceCollection(passport);
    const exchange = buildEvidenceExchange({ issuer, collection, secret: exchangeSecret(), issuedAt });

    return NextResponse.json(exchange, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[exchange/issue]', error);
    const detail = 'Exchange issuance failed.';
    return NextResponse.json(
      { error: 'issue_failed', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
