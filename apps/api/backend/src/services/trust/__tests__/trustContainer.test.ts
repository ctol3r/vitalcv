/**
 * Trust container foundation tests (Wave 2).
 *
 * These tests cover the provider abstraction in isolation. They do
 * NOT touch the database, do NOT make network calls, and rely only on
 * in-process crypto helpers. If this file ever imports `prisma` or a
 * live HTTP client, something has gone wrong.
 */

import http from 'node:http';
import https from 'node:https';
import {
  createTrustContainer,
  MockTrustContainer,
  DockTrustContainer,
  CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
  TrustContainerProviderError,
  assertLimitationConsistency,
  type CredentialEnvelopePayload,
} from '../container';

function baseEnvelope(
  overrides: Partial<CredentialEnvelopePayload> = {},
): CredentialEnvelopePayload {
  return {
    entityId: 'artifact_abc123',
    subject: { npi: '1234567890', entityId: 'artifact_abc123' },
    clinicianNpi: '1234567890',
    sourceCoverage: ['NPPES', 'OIG_LEIE'],
    psvReceiptRefs: [
      {
        receiptId: 'rcpt_nppes_1',
        source: 'NPPES',
        verifiedAt: '2026-04-24T00:00:00.000Z',
        checksum: 'a'.repeat(64),
      },
      {
        receiptId: 'rcpt_oig_1',
        source: 'OIG_LEIE',
        verifiedAt: '2026-04-24T00:00:00.000Z',
        checksum: 'b'.repeat(64),
      },
    ],
    proofTier: 'DECISION_GRADE',
    freshness: {
      label: 'REAL_TIME',
      evidenceAsOf: '2026-04-24T00:00:00.000Z',
      ttlSeconds: 604800,
    },
    limitationNotes: [],
    auditHash: 'c'.repeat(64),
    issuer: {
      did: 'did:vitalcv:issuer_default',
      name: 'VitalCV',
      provider: 'mock',
    },
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    status: 'DECISION_GRADE',
    ...overrides,
  };
}

describe('MockTrustContainer', () => {
  it('reports healthy', async () => {
    const provider = new MockTrustContainer();
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.status).toBe('mock-provider-healthy');
  });

  it('issues and verifies deterministic credentials', async () => {
    const provider = new MockTrustContainer();
    const envelope = baseEnvelope();

    const issued1 = await provider.issueCredential(envelope);
    const issued2 = await provider.issueCredential(envelope);

    expect(issued1.mock).toBe(true);
    expect(issued2.mock).toBe(true);
    expect(issued1.id).toBe(issued2.id);
    expect(issued1.envelopeHash).toBe(issued2.envelopeHash);
    expect(issued1.issuedAt).toBe(issued2.issuedAt);
    expect(issued1.did).toBe('did:vitalcv-mock:issuer');

    const verify = await provider.verifyCredential(issued1.vcPayload);
    expect(verify.valid).toBe(true);
    expect(verify.mock).toBe(true);
    expect(verify.envelopeHash).toBe(issued1.envelopeHash);
  });

  it('changes envelope hash when the payload changes', async () => {
    const provider = new MockTrustContainer();
    const a = await provider.issueCredential(baseEnvelope());
    const b = await provider.issueCredential(
      baseEnvelope({ auditHash: 'd'.repeat(64) }),
    );
    expect(a.envelopeHash).not.toBe(b.envelopeHash);
    expect(a.id).not.toBe(b.id);
  });

  it('hashes equivalent nested envelopes deterministically across key order', async () => {
    const provider = new MockTrustContainer();
    const a = await provider.issueCredential(baseEnvelope());
    const b = await provider.issueCredential({
      status: 'DECISION_GRADE',
      schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
      issuer: { provider: 'mock', name: 'VitalCV', did: 'did:vitalcv:issuer_default' },
      auditHash: 'c'.repeat(64),
      limitationNotes: [],
      freshness: {
        ttlSeconds: 604800,
        evidenceAsOf: '2026-04-24T00:00:00.000Z',
        label: 'REAL_TIME',
      },
      proofTier: 'DECISION_GRADE',
      psvReceiptRefs: [
        {
          checksum: 'a'.repeat(64),
          verifiedAt: '2026-04-24T00:00:00.000Z',
          source: 'NPPES',
          receiptId: 'rcpt_nppes_1',
        },
        {
          checksum: 'b'.repeat(64),
          verifiedAt: '2026-04-24T00:00:00.000Z',
          source: 'OIG_LEIE',
          receiptId: 'rcpt_oig_1',
        },
      ],
      sourceCoverage: ['NPPES', 'OIG_LEIE'],
      clinicianNpi: '1234567890',
      subject: { entityId: 'artifact_abc123', npi: '1234567890' },
      entityId: 'artifact_abc123',
    });
    expect(a.envelopeHash).toBe(b.envelopeHash);
    expect(a.id).toBe(b.id);
  });

  it('rejects DECISION_GRADE issuance when limitations exist', async () => {
    const provider = new MockTrustContainer();
    const envelope = baseEnvelope({
      limitationNotes: ['Identity not strictly verified'],
    });

    await expect(provider.issueCredential(envelope)).rejects.toMatchObject({
      name: 'TrustContainerProviderError',
      code: 'LIMITATION_CONFLICT',
    });
  });

  it('preserves limitations in the vc payload when status is PARTIAL', async () => {
    const provider = new MockTrustContainer();
    const envelope = baseEnvelope({
      status: 'PARTIAL',
      proofTier: 'PARTIAL',
      limitationNotes: ['Identity not strictly verified'],
    });

    const issued = await provider.issueCredential(envelope);
    const vc = issued.vcPayload as { credentialSubject: CredentialEnvelopePayload };
    expect(vc.credentialSubject.status).toBe('PARTIAL');
    expect(vc.credentialSubject.limitationNotes).toEqual([
      'Identity not strictly verified',
    ]);
    expect(vc.credentialSubject.proofTier).toBe('PARTIAL');
  });

  it('anchors receipts with a mock-namespaced txHash', async () => {
    const provider = new MockTrustContainer();
    const r1 = await provider.anchorReceipt({ a: 1, b: 2 });
    const r2 = await provider.anchorReceipt({ b: 2, a: 1 }); // key order flipped
    expect(r1.mock).toBe(true);
    expect(r1.txHash.startsWith('mock:')).toBe(true);
    expect(r1.txHash).toBe(r2.txHash); // canonical hashing
    expect(r1.receiptId).toBe(r2.receiptId);
  });

  it('createPresentation / resolveDid / exportProofBundle are mock-tagged', async () => {
    const provider = new MockTrustContainer();
    const vp = await provider.createPresentation([{ type: 'vc' }]);
    expect(vp.mock).toBe(true);
    const did = await provider.resolveDid('did:vitalcv-mock:test');
    expect(did.mock).toBe(true);
    expect(did.did).toBe('did:vitalcv-mock:test');
    const bundle = await provider.exportProofBundle('artifact_xyz');
    expect(bundle.mock).toBe(true);
    expect(bundle.entityId).toBe('artifact_xyz');
  });
});

describe('DockTrustContainer (scaffold)', () => {
  it('does not crash when constructed with no config', () => {
    expect(() => new DockTrustContainer({ provider: 'dock' })).not.toThrow();
  });

  it('healthCheck reports unconfigured when env is missing', async () => {
    const provider = new DockTrustContainer({ provider: 'dock' });
    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.status).toBe('dock-provider-unconfigured');
    expect(health.reason).toMatch(/DOCK_API_URL/);
    expect(health.reason).toMatch(/DOCK_API_KEY/);
    expect(health.reason).toMatch(/DOCK_ISSUER_DID/);
  });

  it('healthCheck is ok when fully configured', async () => {
    const provider = new DockTrustContainer({
      provider: 'dock',
      apiUrl: 'https://api.dock.test',
      apiKey: 'test_key',
      issuerDid: 'did:dock:abc',
      network: 'testnet',
    });
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.status).toBe('dock-provider-configured');
    expect(health.reason).toMatch(/network=testnet/);
  });

  it('issueCredential throws MISSING_CONFIG when unconfigured', async () => {
    const provider = new DockTrustContainer({ provider: 'dock' });
    await expect(provider.issueCredential(baseEnvelope())).rejects.toMatchObject({
      name: 'TrustContainerProviderError',
      code: 'MISSING_CONFIG',
    });
  });

  it('issueCredential produces deterministic scaffold id when configured', async () => {
    const provider = new DockTrustContainer({
      provider: 'dock',
      apiUrl: 'https://api.dock.test',
      apiKey: 'k',
      issuerDid: 'did:dock:abc',
    });
    const a = await provider.issueCredential(baseEnvelope());
    const b = await provider.issueCredential(baseEnvelope());
    expect(a.id).toBe(b.id);
    expect(a.envelopeHash).toBe(b.envelopeHash);
    expect(a.id.startsWith('dock_vc_scaffold_')).toBe(true);
    expect(a.mock).toBeUndefined();
  });

  it('uses deterministic canonical hashing for Dock scaffold envelopes', async () => {
    const provider = new DockTrustContainer({
      provider: 'dock',
      apiUrl: 'https://api.dock.test',
      apiKey: 'k',
      issuerDid: 'did:dock:abc',
    });
    const a = await provider.issueCredential(baseEnvelope());
    const b = await provider.issueCredential({
      ...baseEnvelope(),
      subject: { entityId: 'artifact_abc123', npi: '1234567890' },
      issuer: { provider: 'mock', name: 'VitalCV', did: 'did:vitalcv:issuer_default' },
    });
    expect(a.envelopeHash).toBe(b.envelopeHash);
  });

  it('verifyCredential returns invalid-with-reason until live integration lands', async () => {
    const provider = new DockTrustContainer({
      provider: 'dock',
      apiUrl: 'u',
      apiKey: 'k',
      issuerDid: 'd',
    });
    const v = await provider.verifyCredential({});
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
});

describe('assertLimitationConsistency', () => {
  it('accepts a clean DECISION_GRADE envelope', () => {
    expect(() => assertLimitationConsistency(baseEnvelope())).not.toThrow();
  });

  it('rejects DECISION_GRADE with limitations', () => {
    expect(() =>
      assertLimitationConsistency(
        baseEnvelope({ limitationNotes: ['something'] }),
      ),
    ).toThrow(TrustContainerProviderError);
  });

  it('rejects mismatched tier vs status', () => {
    expect(() =>
      assertLimitationConsistency(baseEnvelope({ proofTier: 'PARTIAL' })),
    ).toThrow(/proofTier=DECISION_GRADE/);
  });

  it('rejects PARTIAL status with decision-grade proof tier', () => {
    expect(() =>
      assertLimitationConsistency(baseEnvelope({ status: 'PARTIAL' })),
    ).toThrow(/status=DECISION_GRADE/);
  });

  it('rejects unsupported schema versions', () => {
    expect(() =>
      assertLimitationConsistency(
        baseEnvelope({ schemaVersion: '0.0.0' as unknown as typeof CREDENTIAL_ENVELOPE_SCHEMA_VERSION }),
      ),
    ).toThrow(/schemaVersion/);
  });
});

describe('createTrustContainer factory', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('defaults to mock provider when env is unset', () => {
    delete process.env.TRUST_CONTAINER_PROVIDER;
    expect(createTrustContainer().kind).toBe('mock');
  });

  it('returns dock scaffold when opted in via env', () => {
    process.env.TRUST_CONTAINER_PROVIDER = 'dock';
    expect(createTrustContainer().kind).toBe('dock');
  });

  it('throws on unknown provider opt-in', () => {
    process.env.TRUST_CONTAINER_PROVIDER = 'wallet-bridge';
    expect(() => createTrustContainer()).toThrow(/Unsupported trust container provider/);
  });
});

describe('no live network in unit tests', () => {
  it('never calls http.request / https.request during trust container operations', async () => {
    const httpSpy = jest.spyOn(http, 'request');
    const httpsSpy = jest.spyOn(https, 'request');
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled'));
    try {
      const mock = new MockTrustContainer();
      await mock.healthCheck();
      await mock.issueCredential(baseEnvelope());
      await mock.anchorReceipt({ x: 1 });
      await mock.createPresentation([]);
      await mock.resolveDid('did:vitalcv-mock:x');
      await mock.exportProofBundle('entity');

      const dock = new DockTrustContainer({
        provider: 'dock',
        apiUrl: 'u',
        apiKey: 'k',
        issuerDid: 'd',
      });
      await dock.healthCheck();
      await dock.issueCredential(baseEnvelope());
      await dock.anchorReceipt({ x: 1 });

      expect(httpSpy).not.toHaveBeenCalled();
      expect(httpsSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      httpSpy.mockRestore();
      httpsSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });
});
