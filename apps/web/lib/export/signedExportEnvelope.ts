/**
 * Signed export envelope — ENTERPRISE-1 PR339A.
 *
 * Pure primitive that wraps any export payload in an envelope
 * carrying:
 *   - canonical-JSON SHA-256 digest of the payload (always)
 *   - optional ES256 detached JWS signature over that digest
 *   - sealedAt ISO timestamp
 *   - schema version pin
 *
 * Truth-contract invariants:
 *   - Digest is computed over canonical-JSON(sorted-keys) of the
 *     payload — deterministic, byte-identical for identical input.
 *   - Signature is OPTIONAL. The envelope is valid without one — but
 *     `signed` is then explicitly false. We never fabricate a
 *     signature or claim one exists when it doesn't.
 *   - The signer function is injected (dependency injection), not
 *     imported, so this module stays free of crypto-service deps.
 *     `apps/web/lib/trust/cryptoService.ts:signPayloadES256` is the
 *     canonical signer to inject in production.
 *   - Verifying a digest is a pure function — `verifyExportEnvelope`
 *     recomputes from the payload and compares. Tampering with either
 *     digest or payload is detectable.
 *
 * Used by future export routes to upgrade an unsigned packet to a
 * signed audit-grade artifact without invasive surgery on the export
 * builder. The builder calls `buildSignedExportEnvelope(payload, ...)`
 * at the response boundary.
 *
 * Doctrine link: same canonical-JSON-then-SHA-256 pattern as
 * `apps/web/lib/trust/replay-lineage.ts` (#312) and
 * `apps/api/backend/src/services/passport/replayLineage.ts` (#313).
 */

import { createHash } from 'node:crypto';

export const SIGNED_EXPORT_ENVELOPE_SCHEMA = 'vitalcv.export.envelope.v1' as const;

export interface SignedExportEnvelope<T = unknown> {
  readonly schema: typeof SIGNED_EXPORT_ENVELOPE_SCHEMA;
  /** The original payload, structurally unchanged. */
  readonly payload: T;
  /** SHA-256 hex of canonical-JSON(payload). 64 lowercase hex chars. */
  readonly digest: string;
  /** ISO timestamp the envelope was sealed. */
  readonly sealedAt: string;
  /** True when a signature is present. Never inferred — derived from the field. */
  readonly signed: boolean;
  /**
   * Optional ES256 detached JWS over the digest (NOT over the
   * payload). Verifiers recompute the digest from the payload and
   * verify the signature against that digest.
   */
  readonly signature?: string;
  /** Key id of the signing key, when signed. */
  readonly kid?: string;
}

/**
 * Deterministic JSON serialization with sorted keys. Mirrors
 * apps/web/lib/trust/replay-lineage.ts canonicalJson byte-for-byte.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
    .join(',');
  return '{' + body + '}';
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function computeExportDigest(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}

/**
 * Optional async signer the caller injects. In production this is
 * a closure over `signPayloadES256` from
 * apps/web/lib/trust/cryptoService.ts — but we accept any function
 * that returns {jwt, kid} so this module stays dep-free and
 * testable.
 */
export type EnvelopeSigner = (digest: string) => Promise<{ jwt: string; kid: string }>;

export async function buildSignedExportEnvelope<T>(input: {
  payload: T;
  sealedAt: string;
  /** Optional signer. When omitted, envelope is built unsigned. */
  signer?: EnvelopeSigner;
}): Promise<SignedExportEnvelope<T>> {
  const digest = computeExportDigest(input.payload);

  if (!input.signer) {
    return Object.freeze({
      schema: SIGNED_EXPORT_ENVELOPE_SCHEMA,
      payload: input.payload,
      digest,
      sealedAt: input.sealedAt,
      signed: false,
    });
  }

  // If the injected signer fails, we fall back to an unsigned envelope
  // and report `signed: false`. We do not silently fabricate a
  // signature or throw — failure visibility is part of the truth
  // contract. Callers can inspect `signed` to decide whether to
  // surface a warning.
  let signed: { jwt: string; kid: string } | null = null;
  try {
    signed = await input.signer(digest);
  } catch {
    signed = null;
  }

  if (!signed || typeof signed.jwt !== 'string' || signed.jwt.length === 0) {
    return Object.freeze({
      schema: SIGNED_EXPORT_ENVELOPE_SCHEMA,
      payload: input.payload,
      digest,
      sealedAt: input.sealedAt,
      signed: false,
    });
  }

  return Object.freeze({
    schema: SIGNED_EXPORT_ENVELOPE_SCHEMA,
    payload: input.payload,
    digest,
    sealedAt: input.sealedAt,
    signed: true,
    signature: signed.jwt,
    kid: signed.kid,
  });
}

/**
 * Recomputes the digest from the payload and compares to the
 * envelope's claimed digest. Returns true iff they match.
 *
 * Verifying the signature itself is the verifier's job — this
 * function only validates the integrity of the digest/payload pair.
 * (A verifier with the public JWKS can validate `envelope.signature`
 * against `envelope.digest` separately.)
 */
export function verifyExportEnvelopeDigest<T>(envelope: SignedExportEnvelope<T>): boolean {
  const recomputed = computeExportDigest(envelope.payload);
  return recomputed === envelope.digest;
}
