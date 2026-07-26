/**
 * vitalcvTrustContainer.test.ts — self-issued ES256 container provider.
 *
 * Contract under test (ADR adr-credential-container-provider.md):
 *   - real signature: issued VC-JWTs verify against the issuer public key
 *     and fail closed on tamper
 *   - mock is always false; envelope hash stays correlation-compatible
 *     with the mock provider's hash domain
 *   - missing signing config is MISSING_CONFIG (→ failed manifest entry
 *     upstream), never a silent mock fallback
 *   - anchoring refuses per the substrate ADR (no fabricated txHash)
 */

import { exportJWK, generateKeyPair } from 'jose';
import type { CredentialEnvelopePayload } from '../trustContainerContract';
import {
  CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
  TrustContainerProviderError,
} from '../trustContainerContract';
import { MockTrustContainer } from '../mockTrustContainer';
import { buildTrustContainerManifestEntry } from '../trustContainerManifest';
import { createTrustContainer } from '../index';
import { VitalCvTrustContainer } from '../vitalcvTrustContainer';

const TEST_KID = 'vcv-es256-test-1';
const TEST_DID = 'did:web:vitalcv.com';

let privateJwkJson: string;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(privateKey);
  privateJwkJson = JSON.stringify(jwk);
});

function envelope(overrides: Partial<CredentialEnvelopePayload> = {}): CredentialEnvelopePayload {
  return {
    entityId: 'artifact_abc123',
    subject: { npi: '1234567890', entityId: 'artifact_abc123' },
    clinicianNpi: '1234567890',
    sourceCoverage: ['NPPES', 'OIG_LEIE'],
    psvReceiptRefs: [],
    proofTier: 'PARTIAL',
    freshness: {
      label: 'REAL_TIME',
      evidenceAsOf: '2026-04-24T00:00:00.000Z',
      ttlSeconds: 604800,
    },
    limitationNotes: ['Identity not strictly verified'],
    auditHash: 'b'.repeat(64),
    issuer: { did: TEST_DID, name: 'VitalCV', provider: 'vitalcv' },
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    status: 'PARTIAL',
    ...overrides,
  };
}

function provider(): VitalCvTrustContainer {
  return new VitalCvTrustContainer({
    privateKeyJwk: privateJwkJson,
    kid: TEST_KID,
    issuerDid: TEST_DID,
  });
}

describe('VitalCvTrustContainer', () => {
  test('missing signing config throws MISSING_CONFIG (fail closed, no mock fallback)', () => {
    delete process.env.RECEIPT_PRIVATE_KEY_JWK;
    delete process.env.RECEIPT_KID;

    expect(() => new VitalCvTrustContainer()).toThrow(TrustContainerProviderError);
    try {
      new VitalCvTrustContainer();
    } catch (err) {
      expect((err as TrustContainerProviderError).code).toBe('MISSING_CONFIG');
    }
  });

  test('issues a non-mock ES256 VC-JWT that verifies against the issuer key', async () => {
    const container = provider();
    const issued = await container.issueCredential(envelope());

    expect(issued.mock).toBe(false);
    expect(issued.id.startsWith('vcv_vc_')).toBe(true);
    expect(issued.did).toBe(TEST_DID);

    const vcPayload = issued.vcPayload as { format: string; jwt: string };
    expect(vcPayload.format).toBe('vc+jwt');
    expect(vcPayload.jwt.split('.')).toHaveLength(3);

    const verification = await container.verifyCredential(vcPayload);
    expect(verification.valid).toBe(true);
    expect(verification.errors).toEqual([]);
    expect(verification.envelopeHash).toBe(issued.envelopeHash);
    expect(verification.mock).toBe(false);
  });

  test('tampered VC-JWT fails verification', async () => {
    const container = provider();
    const issued = await container.issueCredential(envelope());
    const { jwt } = issued.vcPayload as { jwt: string };
    const [header, payload, signature] = jwt.split('.');
    const tamperedPayload = payload.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));

    const verification = await container.verifyCredential(
      `${header}.${tamperedPayload}.${signature}`,
    );

    expect(verification.valid).toBe(false);
    expect(verification.errors.length).toBeGreaterThan(0);
  });

  test('envelope hash stays correlation-compatible with the mock provider domain', async () => {
    const payload = envelope();
    const signed = await provider().issueCredential(payload);
    const mock = await new MockTrustContainer().issueCredential(payload);

    expect(signed.envelopeHash).toBe(mock.envelopeHash);
  });

  test('limitation consistency is enforced before signing', async () => {
    const container = provider();
    await expect(
      container.issueCredential(
        envelope({ status: 'DECISION_GRADE', proofTier: 'DECISION_GRADE' }),
      ),
    ).rejects.toThrow(/limitations exist/i);
  });

  test('anchorReceipt refuses per the substrate ADR instead of fabricating a txHash', async () => {
    await expect(provider().anchorReceipt({ any: 'receipt' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  test('resolveDid returns the issuer DID document without private key material', async () => {
    const doc = await provider().resolveDid(TEST_DID);

    expect(doc.did).toBe(TEST_DID);
    expect(doc.mock).toBe(false);
    const method = (doc.document.verificationMethod as Array<Record<string, unknown>>)[0];
    expect(method.id).toBe(`${TEST_DID}#${TEST_KID}`);
    const publicJwk = method.publicKeyJwk as Record<string, unknown>;
    expect(publicJwk.kty).toBe('EC');
    expect(publicJwk.d).toBeUndefined();
    expect(JSON.stringify(doc)).not.toContain('"d"');
  });

  test('resolveDid refuses foreign DIDs', async () => {
    await expect(provider().resolveDid('did:web:example.com')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  test('manifest entry labels the environment vitalcv-signed and is not mock', async () => {
    const payload = envelope();
    const issuance = await provider().issueCredential(payload);
    const entry = buildTrustContainerManifestEntry({
      issuance,
      envelope: payload,
      provider: 'vitalcv',
    });

    expect(entry.environment).toBe('vitalcv-signed');
    expect(entry.label).toBe('Signed credential container (VitalCV issuer)');
    expect(entry.mock).toBe(false);
    expect(entry.status).toBe('issued');
  });

  describe('createTrustContainer selection', () => {
    const originalProvider = process.env.TRUST_CONTAINER_PROVIDER;
    const originalKey = process.env.RECEIPT_PRIVATE_KEY_JWK;
    const originalKid = process.env.RECEIPT_KID;

    afterEach(() => {
      const restore = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };
      restore('TRUST_CONTAINER_PROVIDER', originalProvider);
      restore('RECEIPT_PRIVATE_KEY_JWK', originalKey);
      restore('RECEIPT_KID', originalKid);
    });

    test('default stays mock (ships dark)', () => {
      delete process.env.TRUST_CONTAINER_PROVIDER;
      expect(createTrustContainer().kind).toBe('mock');
    });

    test('TRUST_CONTAINER_PROVIDER=vitalcv with key env selects the signer', () => {
      process.env.TRUST_CONTAINER_PROVIDER = 'vitalcv';
      process.env.RECEIPT_PRIVATE_KEY_JWK = privateJwkJson;
      process.env.RECEIPT_KID = TEST_KID;
      expect(createTrustContainer().kind).toBe('vitalcv');
    });

    test('TRUST_CONTAINER_PROVIDER=vitalcv without key env throws MISSING_CONFIG (never falls back to mock)', () => {
      process.env.TRUST_CONTAINER_PROVIDER = 'vitalcv';
      delete process.env.RECEIPT_PRIVATE_KEY_JWK;
      delete process.env.RECEIPT_KID;
      expect(() => createTrustContainer()).toThrow(TrustContainerProviderError);
    });
  });
});
