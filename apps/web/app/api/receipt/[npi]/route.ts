/**
 * GET /api/receipt/:npi
 *
 * Issues a cryptographically-signed VC 2.0 receipt for the current
 * passport state of an NPI. An external verifier can fetch this
 * receipt and validate it against the JWKS published at
 * `/.well-known/jwks.json` (and the issuer DID at `/.well-known/did.json`)
 * without any privileged access to VitalCV.
 *
 * Receipt shape (ES256 JWT, kid header points to active key):
 *
 *   header   { alg: 'ES256', kid: <active-kid>, typ: 'vc+jwt' }
 *   payload  { iss: <issuer-did>,
 *              sub: <npi>,
 *              jti: <deterministic per evidence snapshot>,
 *              iat, exp,
 *              vc: W3C VC 2.0 credential block,
 *              vcv: VitalCV-specific claim block including replay identity }
 *
 * Determinism:
 *   - `jti` is derived from `replay.runId` so the same evidence snapshot
 *     produces an identifiable receipt. Re-issuance for the same evidence
 *     remains observable because timestamps differ, but the jti acts as
 *     a stable cross-receipt key for the underlying snapshot.
 *   - `iat` is pinned to `lastCheckedAt` so two receipts issued for the
 *     same snapshot are byte-identical (the signature itself is
 *     non-deterministic by ES256 spec, but the payload is).
 *
 * Download flow:
 *   `?format=download` adds `Content-Disposition: attachment` so a
 *   verifier engineer can save the JWT to disk for offline validation.
 *
 * Replay-linked:
 *   `vcv.replay = { lineageKey, runId, schemeVersion }` echoes the same
 *   identity contract Wave 10 (#343) emits on the passport response,
 *   so a verifier can join a receipt to its passport snapshot via
 *   `lineageKey`.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { BACKEND_URL } from '@/lib/backend-url';
import { getOrInitKeypair } from '@/lib/crypto/receiptIssuer';
import {
  getIssuerDid,
  getIssuerOrigin,
} from '@/lib/trust/wellKnownIdentity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VCT_URL = 'https://vct.vitalcv.com/trust-receipt/v1';
const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;

interface PassportShape {
  entityId: string;
  npi?: string;
  identity?: { displayName?: string; entityType?: string; specialty?: string; status?: string };
  readiness?: { score?: number; level?: string; status?: string };
  trustPosture?: { band?: string };
  lastCheckedAt?: string;
  replay?: { lineageKey: string; runId: string; schemeVersion: 'v1' };
}

async function fetchPassport(npi: string): Promise<{ ok: true; passport: PassportShape } | { ok: false; status: number; error: string }> {
  if (!/^\d{10}$/.test(npi)) {
    return { ok: false, status: 400, error: 'NPI must be a 10-digit string.' };
  }
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/passport/npi/${encodeURIComponent(npi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    return { ok: false, status: 503, error: `Upstream unreachable: ${String(err)}` };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Backend returned ${res.status}.` };
  }
  const payload = (await res.json().catch(() => null)) as PassportShape | null;
  if (!payload || typeof payload.entityId !== 'string') {
    return { ok: false, status: 502, error: 'Invalid upstream payload.' };
  }
  return { ok: true, passport: payload };
}

function buildReceiptJti(runId: string | undefined, npi: string): string {
  // Stable across re-issuance for the same evidence snapshot.
  const base = runId && runId.length > 0 ? runId : `npi:${npi}`;
  return `receipt:${base}`;
}

function buildReceiptPayload(passport: PassportShape, npi: string, iat: number) {
  const did = getIssuerDid();
  const origin = getIssuerOrigin();
  const jti = buildReceiptJti(passport.replay?.runId, npi);

  return {
    iss: did,
    sub: `npi:${npi}`,
    jti,
    iat,
    nbf: iat,
    exp: iat + NINETY_DAYS_SEC,
    // W3C VC 2.0 credential block. https://www.w3.org/TR/vc-data-model-2.0/
    vc: {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: `urn:vitalcv:receipt:${jti}`,
      type: ['VerifiableCredential', 'VitalCVTrustReceipt'],
      issuer: did,
      validFrom: new Date(iat * 1000).toISOString(),
      validUntil: new Date((iat + NINETY_DAYS_SEC) * 1000).toISOString(),
      credentialSubject: {
        id: `npi:${npi}`,
        displayName: passport.identity?.displayName ?? null,
        entityType: passport.identity?.entityType ?? null,
        specialty: passport.identity?.specialty ?? null,
        readinessLevel: passport.readiness?.level ?? null,
        readinessScore: passport.readiness?.score ?? null,
        trustBand: passport.trustPosture?.band ?? null,
      },
      // Cross-link to the canonical verifier surfaces.
      credentialSchema: { id: VCT_URL, type: 'JsonSchema' },
    },
    // VitalCV claim block — same shape conventions as `signIssuerReceipt`
    // in `lib/crypto/receiptIssuer.ts`, extended with replay identity
    // so a verifier can join the receipt to a passport snapshot.
    vcv: {
      npi,
      entityId: passport.entityId,
      checkedAt: passport.lastCheckedAt ?? null,
      replay: passport.replay
        ? {
            lineageKey: passport.replay.lineageKey,
            runId: passport.replay.runId,
            schemeVersion: passport.replay.schemeVersion,
          }
        : null,
      issuerOrigin: origin,
      jwksUri: `${origin}/.well-known/jwks.json`,
      didDocumentUri: `${origin}/.well-known/did.json`,
    },
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  const result = await fetchPassport(npi);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'passport_unavailable', detail: result.error },
      { status: result.status },
    );
  }
  const { passport } = result;

  // iat pinned to lastCheckedAt seconds so two receipts for the same
  // snapshot share the same iat (signature itself stays
  // non-deterministic per ES256, payload byte-identical).
  const iat = passport.lastCheckedAt
    ? Math.floor(new Date(passport.lastCheckedAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const { privateKey, kid } = await getOrInitKeypair();
  const payload = buildReceiptPayload(passport, npi, iat);

  const jwt = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'vc+jwt' })
    .sign(privateKey);

  // Use plain URL parsing rather than `req.nextUrl` so the handler is
  // portable between NextRequest and bare Request inputs (tests use the
  // latter; production uses NextRequest, which is a superset).
  const wantsDownload = new URL(req.url).searchParams.get('format') === 'download';
  const headers: Record<string, string> = {
    'Content-Type': 'application/jwt',
    'Cache-Control': 'private, no-store',
    'X-Receipt-Kid': kid,
    'X-Receipt-Issuer': getIssuerDid(),
  };
  if (wantsDownload) {
    headers['Content-Disposition'] = `attachment; filename="vitalcv-receipt-${npi}.jwt"`;
  }

  return new NextResponse(jwt, { status: 200, headers });
}
