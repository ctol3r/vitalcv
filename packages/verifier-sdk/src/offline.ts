/**
 * offline.ts — VitalCV Trust Protocol Offline Verification
 *
 * Verify VitalCV artifacts WITHOUT calling the VitalCV API.
 * Anyone who holds the issuer public keys can verify credentials independently.
 *
 * This module implements the portable, self-contained side of the protocol:
 *   - Verify a _crypto envelope signature (Ed25519 / ML-DSA-65 / SLH-DSA-128s)
 *   - Decode and structurally validate a DecisionCapsule
 *   - Compute trust band from a set of canonical facts
 *   - Verify an artifact hash matches its canonical payload
 *
 * Dependencies: none beyond the Web Crypto API (available in Node 18+, browsers, Deno).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
export type SuiteId   = 'sha256' | 'ed25519' | 'ml-dsa-65' | 'slh-dsa-128s';

export interface CryptoEnvelope {
  suite:            SuiteId;
  version:          '1.0';
  keyId:            string;
  signatureHex:     string;
  payloadHash:      string;
  signedAt:         string;
  standard:         string;
  nistFips:         string | null;
  quantumResistant: boolean;
}

export interface IssuerPublicKey {
  keyId:         string;
  suiteId:       SuiteId;
  publicKeyHex:  string;
  issuerUrl:     string;   // fetch from: GET /api/crypto/keys
}

export interface EnvelopeVerifyResult {
  valid:            boolean;
  suiteId:          SuiteId | null;
  keyId:            string | null;
  quantumResistant: boolean;
  signedAt:         string | null;
  error:            string | null;
}

export interface CapsuleValidation {
  structurallyValid: boolean;
  hasRequiredFields: boolean;
  statusValid:       boolean;
  decisionTypeValid: boolean;
  hashPresent:       boolean;
  errors:            string[];
}

export interface TrustBandComputation {
  band:   TrustBand;
  score:  number;
  factors: Record<string, { present: boolean; weight: number; contribution: number }>;
}

// ── Hex utilities ─────────────────────────────────────────────────────────────

function hexDecode(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    buf[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return buf;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Canonical JSON (portable, dependency-free) ────────────────────────────────

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

// ── Signature verification ─────────────────────────────────────────────────────

/**
 * Verify a _crypto envelope signature using the supplied public key.
 *
 * Supports:
 *   ed25519:      WebCrypto native (Node 18+, browsers, Deno)
 *   ml-dsa-65:    requires @noble/post-quantum (optional peer dependency)
 *   slh-dsa-128s: requires @noble/post-quantum (optional peer dependency)
 *
 * @param payload    The canonical bytes that were signed (use buildCanonicalPayload)
 * @param envelope   The _crypto object from rawPayload or metadata
 * @param publicKeys Map of keyId → IssuerPublicKey (fetch from GET /api/crypto/keys)
 */
export async function verifyEnvelope(
  payload:    Uint8Array,
  envelope:   CryptoEnvelope,
  publicKeys: IssuerPublicKey[],
): Promise<EnvelopeVerifyResult> {
  const key = publicKeys.find(k => k.keyId === envelope.keyId);
  if (!key) {
    return { valid: false, suiteId: envelope.suite, keyId: envelope.keyId, quantumResistant: envelope.quantumResistant, signedAt: envelope.signedAt, error: `Public key not found: ${envelope.keyId}` };
  }

  try {
    const sig = hexDecode(envelope.signatureHex);
    const pk  = hexDecode(key.publicKeyHex);

    // Optional: verify payloadHash matches
    const computedHash = await sha256Hex(payload);
    if (computedHash !== envelope.payloadHash) {
      return { valid: false, suiteId: envelope.suite, keyId: envelope.keyId, quantumResistant: envelope.quantumResistant, signedAt: envelope.signedAt, error: `Payload hash mismatch — data may have changed since signing` };
    }

    if (envelope.suite === 'ed25519') {
      const cryptoKey = await crypto.subtle.importKey('raw', pk as unknown as ArrayBuffer, { name: 'Ed25519' }, false, ['verify']);
      const valid = await crypto.subtle.verify('Ed25519', cryptoKey, sig as unknown as ArrayBuffer, payload as unknown as ArrayBuffer);
      return { valid, suiteId: 'ed25519', keyId: envelope.keyId, quantumResistant: false, signedAt: envelope.signedAt, error: null };
    }

    if (envelope.suite === 'ml-dsa-65' || envelope.suite === 'slh-dsa-128s') {
      // Dynamic import — @noble/post-quantum is an optional peer dep.
      // The `.js` suffix is REQUIRED: the package's `exports` map declares
      // `./ml-dsa.js` / `./slh-dsa.js` literally, so an extensionless subpath
      // throws ERR_PACKAGE_PATH_NOT_EXPORTED even when the package IS
      // installed — which the old catch then reported as "not installed".
      try {
        if (envelope.suite === 'ml-dsa-65') {
          const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js' as string) as { ml_dsa65: { verify: (sig: Uint8Array, msg: Uint8Array, pk: Uint8Array) => boolean } };
          const valid = ml_dsa65.verify(sig, payload, pk);
          return { valid, suiteId: 'ml-dsa-65', keyId: envelope.keyId, quantumResistant: true, signedAt: envelope.signedAt, error: null };
        } else {
          const { slh_dsa_shake_128s } = await import('@noble/post-quantum/slh-dsa.js' as string) as { slh_dsa_shake_128s: { verify: (sig: Uint8Array, msg: Uint8Array, pk: Uint8Array) => boolean } };
          const valid = slh_dsa_shake_128s.verify(sig, payload, pk);
          return { valid, suiteId: 'slh-dsa-128s', keyId: envelope.keyId, quantumResistant: true, signedAt: envelope.signedAt, error: null };
        }
      } catch (err) {
        // Report what actually went wrong. The previous message blamed a
        // missing install unconditionally, which sent anyone hitting the
        // subpath bug to reinstall a package they already had.
        return { valid: false, suiteId: envelope.suite, keyId: envelope.keyId, quantumResistant: true, signedAt: envelope.signedAt, error: `PQC verification unavailable (@noble/post-quantum): ${String(err)}` };
      }
    }

    return { valid: false, suiteId: envelope.suite, keyId: envelope.keyId, quantumResistant: envelope.quantumResistant, signedAt: envelope.signedAt, error: `Unsupported suite: ${envelope.suite}` };
  } catch (err) {
    return { valid: false, suiteId: envelope.suite, keyId: envelope.keyId, quantumResistant: envelope.quantumResistant, signedAt: envelope.signedAt, error: String(err) };
  }
}

// ── Canonical payload builders ─────────────────────────────────────────────────

/**
 * Build the canonical bytes for a VerificationArtifact.
 * Must match the server-side artifactCryptoService.ts implementation.
 */
export function buildArtifactCanonicalPayload(artifact: {
  id: string; npi: string; source: string;
  status: string; checksum: string; createdAt: string;
}): Uint8Array {
  const payload = { id: artifact.id, npi: artifact.npi, source: artifact.source, status: artifact.status, checksum: artifact.checksum, createdAt: artifact.createdAt };
  return new TextEncoder().encode(canonicalize(payload));
}

/**
 * Build the canonical bytes for a DecisionCapsule.
 * Must match the server-side artifactCryptoService.ts implementation.
 */
export function buildCapsuleCanonicalPayload(capsule: {
  id: string; subjectNpi: string; decisionType: string;
  decisionTimestamp: string; artifactHash: string; credentialIds: string[];
}): Uint8Array {
  const payload = { id: capsule.id, subjectNpi: capsule.subjectNpi, decisionType: capsule.decisionType, decisionTimestamp: capsule.decisionTimestamp, artifactHash: capsule.artifactHash, credentialIds: [...capsule.credentialIds].sort() };
  return new TextEncoder().encode(canonicalize(payload));
}

// ── Artifact hash verification ────────────────────────────────────────────────

/**
 * Verify that an artifact's checksum matches its canonical content.
 * No API call needed — purely local computation.
 */
export async function verifyArtifactHash(artifact: {
  id: string; npi: string; source: string;
  status: string; checksum: string; createdAt: string;
}): Promise<{ valid: boolean; computedHash: string; storedHash: string }> {
  const canonical     = buildArtifactCanonicalPayload(artifact);
  const computedHash  = await sha256Hex(canonical);
  return { valid: computedHash === artifact.checksum, computedHash, storedHash: artifact.checksum };
}

// ── DecisionCapsule structural validation ─────────────────────────────────────

const REQUIRED_CAPSULE_FIELDS = ['id', 'subjectNpi', 'subjectDid', 'decisionType', 'decisionTimestamp', 'artifactHash', 'status'];
const VALID_DECISION_TYPES    = ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'];
const VALID_STATUSES          = ['VALID', 'AT_RISK', 'INVALID'];

export function validateCapsuleStructure(capsule: Record<string, unknown>): CapsuleValidation {
  const errors: string[] = [];
  const missingFields = REQUIRED_CAPSULE_FIELDS.filter(f => !(f in capsule));
  if (missingFields.length > 0) errors.push(`Missing required fields: ${missingFields.join(', ')}`);
  const decisionTypeValid = VALID_DECISION_TYPES.includes(capsule.decisionType as string);
  if (!decisionTypeValid) errors.push(`Invalid decisionType: ${String(capsule.decisionType)} — must be one of ${VALID_DECISION_TYPES.join(', ')}`);
  const statusValid = VALID_STATUSES.includes(capsule.status as string);
  if (!statusValid) errors.push(`Invalid status: ${String(capsule.status)} — must be one of ${VALID_STATUSES.join(', ')}`);
  const hashPresent = typeof capsule.artifactHash === 'string' && capsule.artifactHash.length === 64;
  if (!hashPresent) errors.push('artifactHash must be a 64-character hex string (SHA-256)');
  return { structurallyValid: errors.length === 0, hasRequiredFields: missingFields.length === 0, statusValid, decisionTypeValid, hashPresent, errors };
}

// ── Trust band computation (portable) ────────────────────────────────────────

/**
 * Compute trust band from a set of boolean facts.
 * Implements methodology 243.1 — matches server-side trustStateEngine.
 *
 * Weight map:
 *   identity       20%  — NPI verified in NPPES
 *   license        30%  — active state license (STATE_BOARD or NURSYS)
 *   sanctions      25%  — OIG/LEIE clear
 *   board_cert     15%  — board certification present
 *   training       10%  — residency/fellowship verified
 */
export function computeTrustBand(facts: {
  identityVerified:    boolean;
  licenseActive:       boolean;
  sanctionsClear:      boolean;
  boardCertified:      boolean;
  trainingVerified:    boolean;
}): TrustBandComputation {
  const weights = { identity: 20, license: 30, sanctions: 25, board_cert: 15, training: 10 };
  const present = {
    identity:   facts.identityVerified,
    license:    facts.licenseActive,
    sanctions:  facts.sanctionsClear,
    board_cert: facts.boardCertified,
    training:   facts.trainingVerified,
  };

  let score = 0;
  const factors: TrustBandComputation['factors'] = {};

  for (const [key, weight] of Object.entries(weights)) {
    const isPresent    = present[key as keyof typeof present] ?? false;
    const contribution = isPresent ? weight : 0;
    score += contribution;
    factors[key] = { present: isPresent, weight, contribution };
  }

  const band: TrustBand =
    score >= 75 ? 'L3' :
    score >= 50 ? 'L2' :
    score >= 25 ? 'L1' : 'L0';

  return { band, score, factors };
}

// ── Discovery document fetcher ────────────────────────────────────────────────

/**
 * Fetch the VitalCV Trust Protocol discovery document.
 * This is the starting point for any third-party integration.
 */
export async function fetchDiscoveryDocument(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/.well-known/vitalcv-trust`, {
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Discovery failed: HTTP ${resp.status}`);
    return await resp.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch issuer public keys from a VitalCV implementation.
 * Store locally and pass to verifyEnvelope() for offline verification.
 */
export async function fetchIssuerPublicKeys(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<IssuerPublicKey[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/.well-known/vitalcv-trust`, { signal: controller.signal });
    const discovery = await resp.json() as Record<string, unknown>;
    const keysUrl = typeof discovery.public_keys_uri === 'string' ? discovery.public_keys_uri : `${baseUrl}/api/crypto/keys`;

    const keysResp = await fetch(keysUrl);
    const keysData = await keysResp.json() as { keys?: IssuerPublicKey[] };
    return Array.isArray(keysData.keys) ? keysData.keys : [];
  } finally {
    clearTimeout(timer);
  }
}
