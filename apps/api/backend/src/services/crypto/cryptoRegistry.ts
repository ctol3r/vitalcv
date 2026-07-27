/**
 * cryptoRegistry.ts — Post-Quantum Crypto Suite Registry
 *
 * Manages all cryptographic suites available to VitalCV:
 *   sha256        Classical SHA-256 hash (baseline, no asymmetric sig)
 *   ed25519       Classical elliptic-curve signature (RFC 8032)
 *   ml-dsa-65     NIST FIPS 204 — Module-Lattice DSA, security level 3 ★ PQC
 *   slh-dsa-128s  NIST FIPS 205 — Stateless Hash-based DSA, smallest sig  ★ PQC
 *
 * Sign API (all suites): sign(payload: Uint8Array, sk: Uint8Array) → Uint8Array
 * Verify API:            verify(sig: Uint8Array, payload: Uint8Array, pk: Uint8Array) → boolean
 *
 * Key registry:
 *   Keys are generated at startup and cached in-memory.
 *   In production, inject via env vars:
 *     VITALCV_KEY_ED25519_PK / VITALCV_KEY_ED25519_SK  (hex)
 *     VITALCV_KEY_ML_DSA_65_PK / VITALCV_KEY_ML_DSA_65_SK
 *     VITALCV_KEY_SLH_DSA_128S_PK / VITALCV_KEY_SLH_DSA_128S_SK
 */

import { webcrypto } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Suite metadata ─────────────────────────────────────────────────────────────

export type SuiteId = 'sha256' | 'ed25519' | 'ml-dsa-65' | 'slh-dsa-128s';

export interface CryptoSuiteInfo {
  id: SuiteId;
  algorithm: string;
  standard: string;
  nistFips: string | null;
  quantumResistant: boolean;
  status: 'ACTIVE' | 'DEPRECATED' | 'EXPERIMENTAL';
  sigLengthBytes: number | null;
  pkLengthBytes: number | null;
  skLengthBytes: number | null;
  securityLevel: string;
  notes: string;
}

export const SUITE_REGISTRY: Record<SuiteId, CryptoSuiteInfo> = {
  'sha256': {
    id: 'sha256', algorithm: 'SHA-256', standard: 'FIPS 180-4', nistFips: 'FIPS 180-4',
    quantumResistant: false, status: 'DEPRECATED',
    sigLengthBytes: null, pkLengthBytes: null, skLengthBytes: null,
    securityLevel: 'Classical — integrity only, no asymmetric signature',
    notes: 'Hash-only baseline. Use ed25519 or PQC suites for new artifacts.',
  },
  'ed25519': {
    id: 'ed25519', algorithm: 'Ed25519', standard: 'RFC 8032', nistFips: null,
    quantumResistant: false, status: 'ACTIVE',
    sigLengthBytes: 64, pkLengthBytes: 32, skLengthBytes: 64,
    securityLevel: '128-bit classical — vulnerable to Shor\'s algorithm on quantum hardware',
    notes: 'Current classical baseline. Schedule migration to ML-DSA-65 by 2030.',
  },
  'ml-dsa-65': {
    id: 'ml-dsa-65', algorithm: 'ML-DSA-65 (CRYSTALS-Dilithium)', standard: 'NIST FIPS 204', nistFips: 'FIPS 204',
    quantumResistant: true, status: 'ACTIVE',
    sigLengthBytes: 3309, pkLengthBytes: 1952, skLengthBytes: 4032,
    securityLevel: 'NIST Level 3 — equivalent to AES-192, quantum-resistant',
    notes: 'Recommended for new credential artifacts. Finalized August 2024.',
  },
  'slh-dsa-128s': {
    id: 'slh-dsa-128s', algorithm: 'SLH-DSA-SHAKE-128s (SPHINCS+)', standard: 'NIST FIPS 205', nistFips: 'FIPS 205',
    quantumResistant: true, status: 'ACTIVE',
    sigLengthBytes: 7856, pkLengthBytes: 32, skLengthBytes: 64,
    securityLevel: 'NIST Level 1 — hash-based, minimal assumptions, long-term archival',
    notes: 'Best for long-lived audit records (decades). Larger sigs but strongest trust assumptions.',
  },
};

// ── Key pair ──────────────────────────────────────────────────────────────────

export interface KeyPair {
  keyId: string;
  suiteId: SuiteId;
  publicKeyHex: string;
  secretKeyHex: string;  // never returned to clients; used internally only
  createdAt: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED';
}

export interface PublicKeyRecord {
  keyId: string;
  suiteId: SuiteId;
  algorithm: string;
  publicKeyHex: string;
  createdAt: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED';
}

// ── Key store (in-memory with env-var injection) ──────────────────────────────

class KeyStore {
  private keys = new Map<string, KeyPair>();

  set(pair: KeyPair): void { this.keys.set(pair.keyId, pair); }

  getPublic(keyId: string): PublicKeyRecord | null {
    const k = this.keys.get(keyId);
    if (!k) return null;
    return { keyId: k.keyId, suiteId: k.suiteId, algorithm: SUITE_REGISTRY[k.suiteId].algorithm, publicKeyHex: k.publicKeyHex, createdAt: k.createdAt, status: k.status };
  }

  getSecret(keyId: string): string | null {
    return this.keys.get(keyId)?.secretKeyHex ?? null;
  }

  listPublic(): PublicKeyRecord[] {
    return Array.from(this.keys.values()).map(k => ({
      keyId: k.keyId, suiteId: k.suiteId, algorithm: SUITE_REGISTRY[k.suiteId].algorithm,
      publicKeyHex: k.publicKeyHex, createdAt: k.createdAt, status: k.status,
    }));
  }

  rotate(keyId: string): void {
    const k = this.keys.get(keyId);
    if (k) { this.keys.set(keyId, { ...k, status: 'ROTATED' }); }
  }

  activeKeyForSuite(suiteId: SuiteId): KeyPair | null {
    for (const k of this.keys.values()) {
      if (k.suiteId === suiteId && k.status === 'ACTIVE') return k;
    }
    return null;
  }
}

export const keyStore = new KeyStore();

// ── PQC module loader (lazy, handles pnpm resolution) ─────────────────────────

/**
 * Subpaths MUST carry the `.js` suffix.
 *
 * `@noble/post-quantum@0.5.x` declares its `exports` map with explicit file
 * names — `./ml-dsa.js`, `./slh-dsa.js` — and Node's exports resolution is a
 * literal match, so the extensionless `@noble/post-quantum/ml-dsa` is not a
 * key and throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The catch below then
 * downgraded every signature to classical, in production, with only a WARN.
 * Found in the Railway log 2026-07-27; the suffix is the entire fix.
 *
 * Verify against the installed package rather than the docs before changing:
 *   node -e "console.log(Object.keys(require('@noble/post-quantum/package.json').exports))"
 */
let _mlDsa65: typeof import('@noble/post-quantum/ml-dsa.js')['ml_dsa65'] | null = null;
let _slhDsa128s: typeof import('@noble/post-quantum/slh-dsa.js')['slh_dsa_shake_128s'] | null = null;
let _pqcLoadAttempted = false;

function loadPQC(): void {
  if (_pqcLoadAttempted) return;
  _pqcLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mlDsaMod  = require('@noble/post-quantum/ml-dsa.js')  as { ml_dsa65: typeof _mlDsa65 };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const slhDsaMod = require('@noble/post-quantum/slh-dsa.js') as { slh_dsa_shake_128s: typeof _slhDsa128s };
    _mlDsa65    = mlDsaMod.ml_dsa65;
    _slhDsa128s = slhDsaMod.slh_dsa_shake_128s;
    log('info', 'cryptoRegistry: PQC algorithms loaded (ML-DSA-65, SLH-DSA-128s)');
  } catch (err) {
    log('warn', 'cryptoRegistry: PQC algorithms unavailable — using classical only', { error: String(err) });
  }
}

// ── Key generation ─────────────────────────────────────────────────────────────

function hexEncode(buf: Uint8Array): string {
  return Buffer.from(buf).toString('hex');
}
function hexDecode(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

async function generateEd25519Pair(keyId: string): Promise<KeyPair> {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'Ed25519' }, true, ['sign', 'verify']
  ) as CryptoKeyPair;

  const [pkRaw, skRaw] = await Promise.all([
    webcrypto.subtle.exportKey('raw', pair.publicKey),
    webcrypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);

  return {
    keyId, suiteId: 'ed25519',
    publicKeyHex:  hexEncode(new Uint8Array(pkRaw)),
    secretKeyHex:  hexEncode(new Uint8Array(skRaw)),
    createdAt: new Date().toISOString(), status: 'ACTIVE',
  };
}

function generateMLDSA65Pair(keyId: string): KeyPair {
  loadPQC();
  if (!_mlDsa65) throw new Error('ML-DSA-65 not available — install @noble/post-quantum');
  const { publicKey, secretKey } = _mlDsa65.keygen();
  return {
    keyId, suiteId: 'ml-dsa-65',
    publicKeyHex: hexEncode(publicKey),
    secretKeyHex: hexEncode(secretKey),
    createdAt: new Date().toISOString(), status: 'ACTIVE',
  };
}

function generateSLHDSA128sPair(keyId: string): KeyPair {
  loadPQC();
  if (!_slhDsa128s) throw new Error('SLH-DSA-128s not available — install @noble/post-quantum');
  const { publicKey, secretKey } = _slhDsa128s.keygen();
  return {
    keyId, suiteId: 'slh-dsa-128s',
    publicKeyHex: hexEncode(publicKey),
    secretKeyHex: hexEncode(secretKey),
    createdAt: new Date().toISOString(), status: 'ACTIVE',
  };
}

// ── Sign / Verify ─────────────────────────────────────────────────────────────

export interface SignResult {
  keyId: string;
  suiteId: SuiteId;
  signatureHex: string;
  payloadHash: string;
  signedAt: string;
}

export async function signWithSuite(
  payload: Uint8Array,
  suiteId: SuiteId,
): Promise<SignResult> {
  loadPQC();

  const key = keyStore.activeKeyForSuite(suiteId);
  if (!key) throw new Error(`No active key for suite ${suiteId} — call initializeCryptoKeys() first`);

  const { createHash } = await import('node:crypto');
  const payloadHash = createHash('sha256').update(payload).digest('hex');
  const signedAt    = new Date().toISOString();

  let signatureHex: string;

  if (suiteId === 'ed25519') {
    const skBytes = hexDecode(key.secretKeyHex);
    const cryptoKey = await webcrypto.subtle.importKey(
      'pkcs8', skBytes, { name: 'Ed25519' }, false, ['sign']
    );
    const sigBuf = await webcrypto.subtle.sign('Ed25519', cryptoKey, payload);
    signatureHex = hexEncode(new Uint8Array(sigBuf));
  } else if (suiteId === 'ml-dsa-65') {
    if (!_mlDsa65) throw new Error('ML-DSA-65 not loaded');
    const sk  = hexDecode(key.secretKeyHex);
    const sig = _mlDsa65.sign(payload, sk);
    signatureHex = hexEncode(sig);
  } else if (suiteId === 'slh-dsa-128s') {
    if (!_slhDsa128s) throw new Error('SLH-DSA-128s not loaded');
    const sk  = hexDecode(key.secretKeyHex);
    const sig = _slhDsa128s.sign(payload, sk);
    signatureHex = hexEncode(sig);
  } else {
    throw new Error(`Suite ${suiteId} does not support asymmetric signing`);
  }

  return { keyId: key.keyId, suiteId, signatureHex, payloadHash, signedAt };
}

export async function verifyWithSuite(
  payload: Uint8Array,
  signatureHex: string,
  keyId: string,
): Promise<{ valid: boolean; suiteId: SuiteId; error?: string }> {
  loadPQC();

  const keyRecord = keyStore.getPublic(keyId);
  if (!keyRecord) return { valid: false, suiteId: 'sha256', error: `Key not found: ${keyId}` };

  const suiteId = keyRecord.suiteId;

  try {
    const sig = hexDecode(signatureHex);
    const pk  = hexDecode(keyRecord.publicKeyHex);

    if (suiteId === 'ed25519') {
      const cryptoKey = await webcrypto.subtle.importKey(
        'raw', pk, { name: 'Ed25519' }, false, ['verify']
      );
      const valid = await webcrypto.subtle.verify('Ed25519', cryptoKey, sig, payload);
      return { valid, suiteId };
    } else if (suiteId === 'ml-dsa-65') {
      if (!_mlDsa65) return { valid: false, suiteId, error: 'ML-DSA-65 not loaded' };
      const valid = _mlDsa65.verify(sig, payload, pk);
      return { valid, suiteId };
    } else if (suiteId === 'slh-dsa-128s') {
      if (!_slhDsa128s) return { valid: false, suiteId, error: 'SLH-DSA-128s not loaded' };
      const valid = _slhDsa128s.verify(sig, payload, pk);
      return { valid, suiteId };
    }

    return { valid: false, suiteId, error: `Suite ${suiteId} does not support asymmetric verification` };
  } catch (err) {
    return { valid: false, suiteId, error: String(err) };
  }
}

// ── Crypto envelope (stored in rawPayload._crypto) ────────────────────────────

export interface CryptoEnvelope {
  suite: SuiteId;
  version: '1.0';
  keyId: string;
  signatureHex: string;
  payloadHash: string;    // SHA-256 of signed canonical payload
  signedAt: string;
  standard: string;
  nistFips: string | null;
  quantumResistant: boolean;
}

export interface CryptoHistory {
  resignedAt: string;
  previousSuite: SuiteId;
  previousKeyId: string;
  reason: string;
}

export function buildEnvelope(result: SignResult, history?: CryptoHistory[]): {
  _crypto: CryptoEnvelope;
  _cryptoHistory?: CryptoHistory[];
} {
  const info = SUITE_REGISTRY[result.suiteId];
  const envelope: CryptoEnvelope = {
    suite:             result.suiteId,
    version:           '1.0',
    keyId:             result.keyId,
    signatureHex:      result.signatureHex,
    payloadHash:       result.payloadHash,
    signedAt:          result.signedAt,
    standard:          info.standard,
    nistFips:          info.nistFips,
    quantumResistant:  info.quantumResistant,
  };
  return history?.length
    ? { _crypto: envelope, _cryptoHistory: history }
    : { _crypto: envelope };
}

// ── Key initialization ─────────────────────────────────────────────────────────

async function initKeyFromEnv(suiteId: SuiteId, keyId: string): Promise<KeyPair | null> {
  const pkEnv = process.env[`VITALCV_KEY_${keyId.toUpperCase().replace(/-/g,'_')}_PK`];
  const skEnv = process.env[`VITALCV_KEY_${keyId.toUpperCase().replace(/-/g,'_')}_SK`];
  if (pkEnv && skEnv) {
    return { keyId, suiteId, publicKeyHex: pkEnv, secretKeyHex: skEnv, createdAt: new Date().toISOString(), status: 'ACTIVE' };
  }
  return null;
}

export async function initializeCryptoKeys(): Promise<void> {
  loadPQC();
  const tasks: Array<() => Promise<void>> = [
    async () => {
      const existing = await initKeyFromEnv('ed25519', 'vitalcv-ed25519-v1');
      const pair = existing ?? await generateEd25519Pair('vitalcv-ed25519-v1');
      keyStore.set(pair);
      log('info', 'cryptoRegistry: Ed25519 key ready', { keyId: pair.keyId });
    },
    async () => {
      if (!_mlDsa65) return;
      const existing = await initKeyFromEnv('ml-dsa-65', 'vitalcv-ml-dsa-65-v1');
      const pair = existing ?? generateMLDSA65Pair('vitalcv-ml-dsa-65-v1');
      keyStore.set(pair);
      log('info', 'cryptoRegistry: ML-DSA-65 key ready', { keyId: pair.keyId });
    },
    async () => {
      if (!_slhDsa128s) return;
      const existing = await initKeyFromEnv('slh-dsa-128s', 'vitalcv-slh-dsa-128s-v1');
      const pair = existing ?? generateSLHDSA128sPair('vitalcv-slh-dsa-128s-v1');
      keyStore.set(pair);
      log('info', 'cryptoRegistry: SLH-DSA-128s key ready', { keyId: pair.keyId });
    },
  ];

  await Promise.allSettled(tasks.map(t => t()));
  log('info', 'cryptoRegistry: initialization complete', {
    suites: keyStore.listPublic().map(k => k.suiteId),
  });
}
