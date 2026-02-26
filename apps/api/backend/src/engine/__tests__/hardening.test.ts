/**
 * Wave 3E — Final Hardening Tests
 *
 * Validates:
 * 1. Deterministic artifactHash stable across identical inputs
 * 2. Signature verifies against JWKS
 * 3. Tampered artifact fails verification
 * 4. Monitoring check runs without crashing
 * 5. No unhandled promise rejections during normal flows
 */
import { generateKeyPairSync } from 'crypto';
import type { NormalizedCredentialPayload, Credential, PsvArtifact } from '../types/psv';
import { buildPsvArtifact, SignFunction } from '../services/artifactBuilder';
import {
  signArtifact,
  verifySignature,
  getJwks,
  _resetKeyCache,
} from '../services/signingService';
import { detectMaterialChange, runMonitoringCheck } from '../services/monitoringEngine';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';

// ── Test fixtures ─────────────────────────────────────────────

function makeCredential(overrides: Partial<Credential> = {}): Credential {
  return {
    credentialType: 'STATE_LICENSE',
    status: 'ACTIVE',
    issuer: 'Internal Medicine',
    issuingStateOrBody: 'CA',
    credentialIdentifier: 'A12345',
    issueDate: '2015-03-01',
    expirationDate: '2026-03-01',
    compactStatus: 'PRIMARY',
    ...overrides,
  };
}

function makePayload(credentials?: Credential[]): NormalizedCredentialPayload {
  return {
    provider: {
      npi: '1234567890',
      type: 'INDIVIDUAL',
      name: { first: 'Jane', last: 'Doe', middle: 'M', suffix: '', credential: 'MD' },
      enumerationDate: '2010-01-15',
      lastUpdated: '2024-06-01',
      status: 'ACTIVE',
    },
    credentials: credentials ?? [makeCredential()],
    retrieval: {
      method: 'API',
      retrievedAt: '2025-01-15T12:00:00.000Z',
      agent: { system: 'vitalcv-engine', version: '1.0.0' },
      source: {
        sourceType: 'NPPES',
        sourceName: 'CMS NPPES',
        sourceUrl: 'https://npiregistry.cms.hhs.gov',
        authoritative: true,
      },
    },
    enrollment: {
      medicareEnrollment: {
        enrollmentType: 'MEDICARE',
        status: 'UNKNOWN',
        effectiveDate: '',
        terminationDate: '',
      },
      medicaidEnrollment: {
        enrollmentType: 'MEDICAID',
        status: 'UNKNOWN',
        effectiveDate: '',
        terminationDate: '',
      },
      stateSpecific: {},
    },
    rawPayload: { result_count: 1, results: [{ number: 1234567890 }] },
  };
}

// ── Setup/teardown ────────────────────────────────────────────

let originalEnv: NodeJS.ProcessEnv;
let testPrivateKey: string;
let testPublicKey: string;

beforeAll(() => {
  originalEnv = { ...process.env };
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  testPrivateKey = privateKey as string;
  testPublicKey = publicKey as string;
});

afterAll(() => {
  process.env = originalEnv;
  _resetKeyCache();
});

beforeEach(() => {
  process.env['PSV_SIGNING_PRIVATE_KEY'] = testPrivateKey;
  process.env['PSV_SIGNING_PUBLIC_KEY'] = testPublicKey;
  process.env['PSV_SIGNING_KID'] = 'hardening-test-key-1';
  _resetKeyCache();
});

// ── 1. Deterministic artifactHash ─────────────────────────────

describe('deterministic artifactHash', () => {
  it('canonicalize(partial) → sha256 is stable for identical partial content', () => {
    // Given the same partial artifact (without integrity), the hash must be identical
    const partial = {
      artifactId: 'fixed-id',
      artifactVersion: '1.0' as const,
      generatedAt: '2025-01-15T12:00:00.000Z',
      provider: makePayload().provider,
      credentials: makePayload().credentials,
      retrieval: makePayload().retrieval,
      decisionWindow: {
        windowStatus: 'WITHIN_WINDOW' as const,
        verifiedAt: '2025-01-15T12:00:00.000Z',
        validUntil: '2025-05-15T12:00:00.000Z',
        windowDays: 120,
        daysRemaining: 90,
      },
      monitoring: {
        enabled: true,
        lastCheckedAt: '2025-01-15T12:00:00.000Z',
        checkIntervalHours: 24,
        deltaLog: [],
      },
      enrollment: makePayload().enrollment,
      deltaLog: [],
    };

    const hash1 = sha256(canonicalize(partial));
    const hash2 = sha256(canonicalize(partial));
    const hash3 = sha256(canonicalize(partial));

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different key ordering produces same hash (canonicalization invariant)', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(sha256(canonicalize(a))).toBe(sha256(canonicalize(b)));
  });

  it('rawPayloadHash is stable across multiple buildPsvArtifact calls', async () => {
    const payload = makePayload();
    const { artifact: a1 } = await buildPsvArtifact(payload, signArtifact);
    const { artifact: a2 } = await buildPsvArtifact(payload, signArtifact);
    expect(a1.integrity.rawPayloadHash).toBe(a2.integrity.rawPayloadHash);
  });

  it('artifactHash reflects actual partial content (verifiable)', async () => {
    const { artifact } = await buildPsvArtifact(makePayload(), signArtifact);
    const { integrity, ...partial } = artifact;
    const recomputed = sha256(canonicalize(partial));
    expect(artifact.integrity.artifactHash).toBe(recomputed);
  });
});

// ── 2. Signature verifies against JWKS ────────────────────────

describe('signature verifies against JWKS', () => {
  it('signArtifact produces JWS that verifySignature accepts', async () => {
    const payload = canonicalize(makePayload());
    const { signature } = await signArtifact(payload);
    const { valid, payload: decoded } = verifySignature(signature);
    expect(valid).toBe(true);
    expect(decoded).toBe(payload);
  });

  it('JWKS contains correct key metadata for ES256', () => {
    const jwks = getJwks();
    expect(jwks.keys).toHaveLength(1);
    const key = jwks.keys[0];
    expect(key['alg']).toBe('ES256');
    expect(key['kty']).toBe('EC');
    expect(key['crv']).toBe('P-256');
    expect(key['use']).toBe('sig');
    expect(key['kid']).toBe('hardening-test-key-1');
    // Must not expose private material
    expect(key['d']).toBeUndefined();
  });

  it('full artifact signature verifies end-to-end', async () => {
    const { artifact } = await buildPsvArtifact(makePayload(), signArtifact);
    const { valid } = verifySignature(artifact.integrity.signature);
    expect(valid).toBe(true);
  });
});

// ── 3. Tampered artifact fails verification ───────────────────

describe('tampered artifact fails verification', () => {
  it('flipped signature byte produces invalid result', async () => {
    const { artifact } = await buildPsvArtifact(makePayload(), signArtifact);
    const parts = artifact.integrity.signature.split('.');
    // Flip a byte near the middle of the signature to guarantee we mutate
    // actual signature data, not just base64 padding bits at the tail.
    const sig = parts[2];
    const mid = Math.floor(sig.length / 2);
    const midChar = sig[mid];
    const replacement = midChar === 'A' ? 'B' : 'A';
    const flipped = sig.slice(0, mid) + replacement + sig.slice(mid + 1);
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
    const { valid } = verifySignature(tampered);
    expect(valid).toBe(false);
  });

  it('modified payload in JWS produces invalid result', async () => {
    const { signature } = await signArtifact('{"npi":"1234567890"}');
    const parts = signature.split('.');
    // Replace a character in the base64url payload
    const payload = parts[1];
    const modified = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A');
    const tampered = `${parts[0]}.${modified}.${parts[2]}`;
    const { valid } = verifySignature(tampered);
    expect(valid).toBe(false);
  });

  it('truncated JWS returns invalid', () => {
    const { valid } = verifySignature('abc.def');
    expect(valid).toBe(false);
  });

  it('empty string returns invalid', () => {
    const { valid } = verifySignature('');
    expect(valid).toBe(false);
  });
});

// ── 4. Monitoring check runs without crashing ─────────────────

describe('monitoring check stability', () => {
  it('runMonitoringCheck completes for no-change case', async () => {
    const payload = makePayload();
    const { artifact } = await buildPsvArtifact(payload, signArtifact);
    const result = await runMonitoringCheck(artifact, payload, signArtifact);
    expect(result.changed).toBe(false);
    expect(result.artifact).toBeDefined();
    expect(result.deltaEntry).toBeNull();
  });

  it('runMonitoringCheck completes for material-change case', async () => {
    const originalPayload = makePayload([makeCredential({ status: 'ACTIVE' })]);
    const { artifact } = await buildPsvArtifact(originalPayload, signArtifact);
    const changedPayload = makePayload([makeCredential({ status: 'REVOKED' })]);
    const result = await runMonitoringCheck(artifact, changedPayload, signArtifact);
    expect(result.changed).toBe(true);
    expect(result.deltaEntry).not.toBeNull();
    expect(result.artifact.deltaLog).toHaveLength(1);
    expect(result.artifact.integrity.artifactHash).toBeDefined();
    expect(result.artifact.integrity.signature).toBeDefined();
  });

  it('detectMaterialChange handles empty credential arrays', () => {
    const result = detectMaterialChange([], []);
    expect(result.materialChange).toBe(false);
    expect(result.changedFields).toHaveLength(0);
  });

  it('detectMaterialChange handles credential removal', () => {
    const result = detectMaterialChange([makeCredential()], []);
    expect(result.materialChange).toBe(true);
  });

  it('sequential monitoring checks accumulate delta log', async () => {
    const payload1 = makePayload([makeCredential({ status: 'ACTIVE' })]);
    const { artifact: a1 } = await buildPsvArtifact(payload1, signArtifact);

    const payload2 = makePayload([makeCredential({ status: 'SUSPENDED' })]);
    const r2 = await runMonitoringCheck(a1, payload2, signArtifact);
    expect(r2.artifact.deltaLog).toHaveLength(1);

    const payload3 = makePayload([makeCredential({ status: 'REVOKED' })]);
    const r3 = await runMonitoringCheck(r2.artifact, payload3, signArtifact);
    expect(r3.artifact.deltaLog).toHaveLength(2);
  });
});

// ── 5. No unhandled promise rejections ────────────────────────

describe('promise rejection safety', () => {
  it('buildPsvArtifact propagates sign rejection', async () => {
    const failingSign: SignFunction = async () => {
      throw new Error('HSM unavailable');
    };
    await expect(buildPsvArtifact(makePayload(), failingSign)).rejects.toThrow(
      'HSM unavailable',
    );
  });

  it('buildPsvArtifact propagates store rejection', async () => {
    const failingStore = async (): Promise<string> => {
      throw new Error('Disk full');
    };
    await expect(
      buildPsvArtifact(makePayload(), signArtifact, failingStore),
    ).rejects.toThrow('Disk full');
  });

  it('runMonitoringCheck propagates sign rejection on material change', async () => {
    const payload = makePayload([makeCredential({ status: 'ACTIVE' })]);
    const { artifact } = await buildPsvArtifact(payload, signArtifact);
    const changedPayload = makePayload([makeCredential({ status: 'EXPIRED' })]);

    const failingSign: SignFunction = async () => {
      throw new Error('Key rotated');
    };
    await expect(
      runMonitoringCheck(artifact, changedPayload, failingSign),
    ).rejects.toThrow('Key rotated');
  });
});
