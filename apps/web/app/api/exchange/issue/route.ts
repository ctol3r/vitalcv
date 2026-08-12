import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { buildEvidenceExchange } from '@/lib/exchange/exchange';
import { authorizeIssuer } from '@/lib/exchange/federation';
import { demoFederation, exchangeIssueConfig, exchangeSecret } from '@/lib/exchange/config';

export const runtime = 'nodejs';

/**
 * POST /api/exchange/issue — Issuer API (Wave 800, C1).
 *
 * Body: `{ entityId: string, issuer: string, issuedAt?: ISO-8601 }`. The
 * requested issuer must exactly equal the server-configured issuer; callers
 * cannot select another federation member.
 *
 * Resolves the clinician's source-backed EvidenceCollection and packages it into
 * a signed `EvidenceExchange`. Gated at the federation boundary: a non-member or
 * a member without the `issuer` role is refused (403). No trust score is placed
 * in the envelope — only signed evidence the receiver re-evaluates itself.
 */
function parseBearer(header: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? '');
  return match ? match[1].trim() : null;
}

function timingSafeSecretEqual(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf-8');
  const expectedBytes = Buffer.from(expected, 'utf-8');
  if (providedBytes.length !== expectedBytes.length) {
    // timingSafeEqual requires equal-size inputs; consume comparable work before
    // rejecting a differently sized credential.
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

export async function POST(req: NextRequest) {
  try {
    const issueConfig = exchangeIssueConfig();
    if (!issueConfig) {
      return NextResponse.json(
        { error: 'issuer_unavailable', error_description: 'Exchange issuance is not configured.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const machineCredential = parseBearer(req.headers.get('authorization'));
    if (!machineCredential || !timingSafeSecretEqual(machineCredential, issueConfig.machineSecret)) {
      return NextResponse.json(
        { error: 'issuer_unauthorized', error_description: 'Valid issuer machine credentials are required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

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

    // The configured issuer is a server-side authority boundary; a caller may
    // state it only to bind the signed request, never to choose another member.
    if (issuer !== issueConfig.issuer) {
      return NextResponse.json(
        { error: 'issuer_not_authorized', error_description: 'Issuer is not authorized to issue exchanges.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Federation authorization (membership + role) before any evidence work.
    const auth = authorizeIssuer(demoFederation(), issueConfig.issuer);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'issuer_not_authorized', error_description: 'Issuer is not authorized to issue exchanges.' },
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
    const exchange = buildEvidenceExchange({
      issuer: issueConfig.issuer,
      collection,
      secret: exchangeSecret(),
      issuedAt,
    });

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
