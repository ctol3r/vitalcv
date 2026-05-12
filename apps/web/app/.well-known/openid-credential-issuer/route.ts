/**
 * GET /.well-known/openid-credential-issuer
 *
 * OID4VCI (OpenID for Verifiable Credential Issuance) issuer metadata.
 *
 * Spec: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 *
 * Verifiers and credential consumers fetch this endpoint to discover:
 *   - the canonical credential-issuer URL
 *   - the credential-issuance endpoint(s)
 *   - the list of supported credential types (`credential_configurations_supported`)
 *   - display metadata for the issuer
 *
 * The credential types listed here correspond to the SD-JWT receipt
 * formats VitalCV currently issues. `credentials_supported` (the
 * older OID4VCI draft-11 field) is also emitted for verifiers that
 * predate the rename in draft-13.
 */
import { NextResponse } from 'next/server';
import { getIssuerOrigin } from '@/lib/trust/wellKnownIdentity';

export const runtime = 'nodejs';
export const revalidate = 3600;

interface CredentialConfiguration {
  format: 'vc+sd-jwt';
  vct: string;
  cryptographic_binding_methods_supported: readonly string[];
  credential_signing_alg_values_supported: readonly string[];
  display: ReadonlyArray<{ name: string; locale: string }>;
}

const CREDENTIAL_CONFIGURATIONS: Readonly<Record<string, CredentialConfiguration>> = {
  VitalCVClinicianPassport: {
    format: 'vc+sd-jwt',
    vct: 'https://vct.vitalcv.com/clinician-passport/v1',
    cryptographic_binding_methods_supported: ['did:web'],
    credential_signing_alg_values_supported: ['ES256'],
    display: [{ name: 'VitalCV Clinician Passport', locale: 'en-US' }],
  },
  VitalCVTrustReceipt: {
    format: 'vc+sd-jwt',
    vct: 'https://vct.vitalcv.com/trust-receipt/v1',
    cryptographic_binding_methods_supported: ['did:web'],
    credential_signing_alg_values_supported: ['ES256'],
    display: [{ name: 'VitalCV Trust Receipt', locale: 'en-US' }],
  },
};

export async function GET() {
  const origin = getIssuerOrigin();

  const metadata = {
    credential_issuer: origin,
    credential_endpoint: `${origin}/api/credentials/issue`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    display: [
      {
        name: 'VitalCV',
        locale: 'en-US',
        logo: {
          uri: `${origin}/brand/vitalcv-logo.svg`,
          alt_text: 'VitalCV',
        },
      },
    ],
    // OID4VCI draft-13+ field.
    credential_configurations_supported: CREDENTIAL_CONFIGURATIONS,
    // OID4VCI draft-11 back-compat: same content, older field name.
    credentials_supported: Object.entries(CREDENTIAL_CONFIGURATIONS).map(
      ([id, cfg]) => ({ id, ...cfg }),
    ),
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/json',
    },
  });
}
