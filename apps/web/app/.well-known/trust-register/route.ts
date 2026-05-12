/**
 * GET /.well-known/trust-register
 *
 * VitalCV-specific institutional trust manifest. Not an external RFC
 * — it's the structured self-description an institutional verifier
 * (NCQA, Joint Commission, hospital procurement) can fetch to inspect
 * VitalCV's trust posture without needing privileged access.
 *
 * Schema version: 1.
 *
 * Contents:
 *   - `issuer`           the canonical issuer DID + origin
 *   - `signing`          algorithm + active kid + JWKS URI
 *   - `runtime`          channel + deploy commit + last-published-at
 *   - `launch_spine`     the four canonical primary-source domains
 *                        VitalCV builds readiness on (NPPES, OIG LEIE,
 *                        PECOS, state board)
 *   - `credentials`      SD-JWT VCT types the issuer can produce
 *   - `endpoints`        sibling .well-known + discovery URIs
 *   - `doctrine`         pointers to the operational doctrine documents
 *                        every verifier can consult
 *   - `disclaimers`      explicit non-claims (no fake PSV, no implied
 *                        compliance certification)
 *
 * Any change to the schema MUST bump `schema_version`.
 */
import { NextResponse } from 'next/server';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';
import {
  getDeployCommit,
  getIssuerDid,
  getIssuerOrigin,
  getRuntimeChannel,
} from '@/lib/trust/wellKnownIdentity';

export const runtime = 'nodejs';
export const revalidate = 3600;

const SCHEMA_VERSION = 1 as const;

const LAUNCH_SPINE = [
  { id: 'NPPES_API', label: 'CMS NPPES', kind: 'identity' },
  { id: 'OIG_LEIE', label: 'OIG LEIE', kind: 'exclusion' },
  { id: 'PECOS_PUBLIC', label: 'CMS PECOS (public)', kind: 'enrollment' },
  { id: 'STATE_BOARD', label: 'State Medical Board', kind: 'licensure' },
] as const;

const CREDENTIALS = [
  {
    type: 'VitalCVClinicianPassport',
    vct: 'https://vct.vitalcv.com/clinician-passport/v1',
    format: 'vc+sd-jwt',
  },
  {
    type: 'VitalCVTrustReceipt',
    vct: 'https://vct.vitalcv.com/trust-receipt/v1',
    format: 'vc+sd-jwt',
  },
] as const;

const DISCLAIMERS = [
  'Source-backed checks are reported with explicit provenance per source; absence of an adverse finding is rendered as "no adverse findings", not as a positive verification claim.',
  'VitalCV does not assert primary-source verification beyond the source it cites for each credential. Where a source could not be reached, the relevant lane is rendered as degraded with an A/B/C/E taxonomy code.',
  'Receipts are cryptographically signed (ES256); signature verification establishes integrity and issuer attribution, not external compliance certification.',
  'Replay identity is deterministic per evidence snapshot; identical persisted inputs produce identical runIds across restart and deploy.',
] as const;

export async function GET() {
  const origin = getIssuerOrigin();
  const did = getIssuerDid();
  const publicKeyJwk = await getPublicKeyJwk();
  const kid = typeof publicKeyJwk.kid === 'string' ? publicKeyJwk.kid : 'vcv-es256';
  const alg = typeof publicKeyJwk.alg === 'string' ? publicKeyJwk.alg : 'ES256';

  const manifest = {
    schema_version: SCHEMA_VERSION,
    schema_url: 'https://vitalcv.com/schemas/trust-register/v1',
    issuer: {
      did,
      origin,
    },
    signing: {
      active_kid: kid,
      algorithm: alg,
      jwks_uri: `${origin}/.well-known/jwks.json`,
      did_document_uri: `${origin}/.well-known/did.json`,
    },
    runtime: {
      channel: getRuntimeChannel(),
      deploy_commit: getDeployCommit(),
      published_at: new Date().toISOString(),
    },
    launch_spine: LAUNCH_SPINE,
    credentials: CREDENTIALS,
    endpoints: {
      jwks: `${origin}/.well-known/jwks.json`,
      did_document: `${origin}/.well-known/did.json`,
      oid4vci_metadata: `${origin}/.well-known/openid-credential-issuer`,
      receipt_verify: `${origin}/api/receipts/verify`,
      verify_surface: `${origin}/verify`,
      passport_by_npi: `${origin}/api/passport/npi/{npi}`,
      health: `${origin}/api/health`,
    },
    doctrine: {
      production_promotion_protocol: `${origin}/docs/ops/production-promotion-protocol.md`,
      replay_survivability_matrix: `${origin}/docs/architecture/replay-survivability-matrix.md`,
    },
    disclaimers: DISCLAIMERS,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Content-Type': 'application/json',
    },
  });
}
