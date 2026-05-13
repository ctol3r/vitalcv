/**
 * GET /.well-known/openid-configuration
 *
 * OpenID Connect Discovery 1.0 surface. VitalCV is a **Verifiable
 * Credential issuer**, not a full OpenID Provider — we don't run
 * authorization or token endpoints. This handler is published as a
 * COURTESY for verifiers that probe `openid-configuration` before
 * (or instead of) `openid-credential-issuer`.
 *
 * The payload contains:
 *
 *   - `issuer` and `jwks_uri`     — real, identical to what's published
 *                                   in the OID4VCI metadata + DID document
 *   - `id_token_signing_alg_values_supported` — `['ES256']` (real)
 *   - `subject_types_supported`    — `['public']` (real)
 *   - `response_types_supported`   — `[]` (we issue VCs, not OIDC tokens)
 *   - `authorization_endpoint`     — pointer to the credential-issuer
 *                                   metadata; intentionally not an
 *                                   OAuth flow endpoint
 *   - `token_endpoint`             — same pointer
 *   - `vitalcv:role`               — non-standard extension; signals
 *                                   "credential_issuer_only"
 *   - `vitalcv:credential_issuer_metadata` — pointer to the canonical
 *                                   discovery surface
 *
 * Verifiers that are strictly RFC-OIDC will see the empty
 * `response_types_supported` and recognize that no OAuth flow is
 * available; verifiers that understand VC issuance will follow the
 * extension pointer to OID4VCI metadata.
 *
 * "No placeholder values" rule (from the shipping brief):
 *   We do NOT fabricate authorization_endpoint / token_endpoint URLs
 *   that look like OAuth flows but aren't. The pointer values are
 *   honest — they go to the OID4VCI metadata endpoint, which is the
 *   real entry point for VitalCV credential issuance.
 */
import { NextResponse } from 'next/server';
import { getIssuerOrigin } from '@/lib/trust/wellKnownIdentity';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET() {
  const origin = getIssuerOrigin();
  const credentialIssuerMetadata = `${origin}/.well-known/openid-credential-issuer`;

  const metadata = {
    issuer: origin,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    response_types_supported: [] as string[],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['ES256'],
    // RFC-required by OIDC discovery; we point them at the credential
    // issuer's discovery surface rather than fabricate OAuth endpoints.
    authorization_endpoint: credentialIssuerMetadata,
    token_endpoint: credentialIssuerMetadata,
    'vitalcv:role': 'credential_issuer_only',
    'vitalcv:credential_issuer_metadata': credentialIssuerMetadata,
    'vitalcv:notes':
      'VitalCV is a Verifiable Credential issuer (OID4VCI), not an OIDC Provider. '
      + 'Use openid-credential-issuer metadata for credential discovery. '
      + 'response_types_supported is intentionally empty.',
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/json',
    },
  });
}
