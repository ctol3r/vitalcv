/**
 * GET /.well-known/jwks.json — web-v2 JWKS endpoint.
 *
 * Mirror of the apps/web endpoint at the same path. Publishes the
 * ES256 public JWK so any verifier can validate signed issuer
 * receipts produced by VitalCV without callback round-trips.
 *
 * Source of the public JWK is the VITALCV_SIGNING_PUBLIC_JWK env var
 * (set in .env.local / Vercel env). The runtime parses it as JSON and
 * serves it inside a JWKS envelope.
 *
 * Truth contract:
 *   - Private key is NEVER read or served from this route.
 *   - When VITALCV_SIGNING_PUBLIC_JWK is absent OR fails to parse,
 *     the route returns `{ keys: [] }` with HTTP 200 — an honestly
 *     empty JWKS. This is fail-closed: verifiers see "no key" and
 *     refuse to validate, rather than getting a fabricated key.
 *   - The response is also tagged with X-JWKS-Status so consumers
 *     can distinguish "no key configured" from "key configured".
 *   - Cache-Control follows the apps/web pattern (1h fresh,
 *     24h stale-while-revalidate) so key rotation doesn't break
 *     in-flight verifications.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

interface PublicJwk {
  readonly kty: string;
  readonly crv?: string;
  readonly x?: string;
  readonly y?: string;
  readonly use?: string;
  readonly alg?: string;
  readonly kid?: string;
}

function isPublicJwk(value: unknown): value is PublicJwk {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  // A JWK MUST have a kty. Anything claiming a `d` field (private
  // component) is rejected — we never serve private material.
  if (typeof obj.kty !== 'string' || obj.kty.length === 0) return false;
  if ('d' in obj) return false;
  return true;
}

export async function GET() {
  const raw = process.env.VITALCV_SIGNING_PUBLIC_JWK;

  if (!raw || raw.length === 0) {
    return NextResponse.json(
      { keys: [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-JWKS-Status': 'not-configured',
        },
      },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { keys: [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-JWKS-Status': 'malformed-env',
        },
      },
    );
  }

  if (!isPublicJwk(parsed)) {
    return NextResponse.json(
      { keys: [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-JWKS-Status': 'invalid-jwk',
        },
      },
    );
  }

  return NextResponse.json(
    { keys: [parsed] },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-JWKS-Status': 'ok',
      },
    },
  );
}
