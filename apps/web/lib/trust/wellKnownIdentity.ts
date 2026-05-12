/**
 * Canonical identity derivation for the four `.well-known/*` surfaces
 * (Wave 9). All surfaces must agree on:
 *
 *  - the issuer origin (host)
 *  - the issuer DID (currently `did:web:<host>`)
 *  - the kid + algorithm published in JWKS
 *  - the credential-issuer endpoint URLs
 *
 * Centralizing the derivation here means a future host rename or DID
 * method change touches one file, not four. Each handler imports from
 * this module and never invents identifiers locally.
 */

const DEFAULT_HOST = 'app.vitalcv.com';

/**
 * Returns the origin the issuer publishes itself under. Order of preference:
 *   1. `VITALCV_ISSUER_ORIGIN` explicit override (production / staging)
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` (deploy-derived)
 *   3. `DEFAULT_HOST` fallback
 *
 * The origin is always returned WITHOUT a trailing slash so callers can
 * concatenate paths safely.
 */
export function getIssuerOrigin(): string {
  const explicit = (process.env.VITALCV_ISSUER_ORIGIN ?? '').trim();
  if (explicit) return normalizeOrigin(explicit);

  const vercelProd = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim();
  if (vercelProd) return normalizeOrigin(`https://${vercelProd}`);

  const vercel = (process.env.VERCEL_URL ?? '').trim();
  if (vercel) return normalizeOrigin(`https://${vercel}`);

  return `https://${DEFAULT_HOST}`;
}

function normalizeOrigin(raw: string): string {
  let value = raw.trim();
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`;
  }
  return value.replace(/\/+$/, '');
}

/**
 * Returns the host portion of the issuer origin (no scheme, no port for
 * standard ports). Used to derive the `did:web:` identifier so it stays
 * in lock-step with the public origin.
 */
export function getIssuerHost(): string {
  const origin = getIssuerOrigin();
  try {
    const url = new URL(origin);
    // did:web encodes the port if non-default. Strip default ports.
    if (
      (url.protocol === 'https:' && (url.port === '' || url.port === '443')) ||
      (url.protocol === 'http:' && (url.port === '' || url.port === '80'))
    ) {
      return url.hostname;
    }
    return `${url.hostname}%3A${url.port}`;
  } catch {
    return DEFAULT_HOST;
  }
}

/**
 * Canonical issuer DID. `did:web:` is used because the JWKS is already
 * published at the same origin — verifiers resolve `did:web:<host>` by
 * fetching `https://<host>/.well-known/did.json`, which this PR mounts.
 */
export function getIssuerDid(): string {
  return `did:web:${getIssuerHost()}`;
}

/**
 * Verification-method id format per W3C DID Core. The fragment matches
 * the JWK `kid` so a verifier reading a receipt's `kid` header can
 * navigate directly to the matching verificationMethod in did.json.
 *
 * The kid is currently produced by `getOrInitKeypair()` in
 * `lib/crypto/receiptIssuer.ts`; this helper accepts the resolved kid
 * so the route handler stays the single point that touches keypair
 * state.
 */
export function getVerificationMethodId(did: string, kid: string): string {
  return `${did}#${kid}`;
}

/**
 * Runtime channel — surfaced on the trust register so external
 * verifiers can tell whether they're inspecting a production issuer or
 * a preview deploy.
 */
export type RuntimeChannel = 'production' | 'staging' | 'operator_preview' | 'local_dev';

export function getRuntimeChannel(): RuntimeChannel {
  const explicit = (process.env.VITALCV_RUNTIME_CHANNEL ?? '').trim().toLowerCase();
  if (explicit === 'production' || explicit === 'staging' || explicit === 'operator_preview' || explicit === 'local_dev') {
    return explicit;
  }
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'operator_preview';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'local_dev';
}

/**
 * Deploy commit (used as a build-identity stamp on the trust register).
 * Falls back to 'unknown' when the env isn't populated (local dev).
 */
export function getDeployCommit(): string {
  return (
    process.env.VITALCV_DEPLOY_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'unknown'
  ).trim() || 'unknown';
}
