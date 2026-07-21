import { NextResponse } from 'next/server';

/**
 * Structural NPI format guard for the public passport proxy routes.
 *
 * Deliberately narrow. This rejects only input that cannot be an NPI at all
 * (anything failing /^\d{10}$/, e.g. `not-a-npi-abc`). It intentionally does
 * NOT validate the CMS check digit, so a well-formed-but-unknown NPI such as
 * `0000000000` still resolves to a degraded passport. That degraded-200 is the
 * intended anti-enumeration posture — an anonymous reader must not be able to
 * tell a real NPI from an unregistered one by status code alone. Rejecting
 * structurally malformed input has no such downside: it reveals nothing except
 * that the caller sent something that was never an identifier.
 *
 * Mirrors `validateNpi` in apps/api/backend/src/routes/passport.ts so the proxy
 * and its upstream reject the same inputs with the same body.
 */
export const NPI_RE = /^\d{10}$/;

export function isStructurallyValidNpi(npi: string | undefined | null): npi is string {
  return typeof npi === 'string' && NPI_RE.test(npi);
}

/** 400 response matching the backend's `invalid_npi` contract byte for byte. */
export function invalidNpiResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'invalid_npi',
      error_description: 'NPI must be a 10-digit string.',
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
