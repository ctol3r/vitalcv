import {
  CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
  DockTrustContainer,
  MockTrustContainer,
  createTrustContainer,
  type CredentialEnvelopePayload,
} from '../index';

function envelope(overrides: Partial<CredentialEnvelopePayload> = {}): CredentialEnvelopePayload {
  return {
    entityId: 'artifact_abc123',
    subject: { npi: '1234567890', entityId: 'artifact_abc123' },
    clinicianNpi: '1234567890',
    sourceCoverage: ['NPPES'],
    psvReceiptRefs: [
      {
        receiptId: 'receipt-1',
        source: 'NPPES',
        verifiedAt: '2026-04-24T00:00:00.000Z',
        checksum: 'a'.repeat(64),
      },
    ],
    proofTier: 'PARTIAL',
    freshness: {
      label: 'REAL_TIME',
      evidenceAsOf: '2026-04-24T00:00:00.000Z',
      ttlSeconds: 604800,
    },
    limitationNotes: ['Identity not strictly verified'],
    auditHash: 'b'.repeat(64),
    issuer: { did: 'did:vitalcv:issuer_default', name: 'VitalCV', provider: 'mock' },
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    status: 'PARTIAL',
    ...overrides,
  };
}

describe('trust container colocated contract smoke', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to the mock provider', () => {
    delete process.env.TRUST_CONTAINER_PROVIDER;
    expect(createTrustContainer()).toBeInstanceOf(MockTrustContainer);
  });

  it('creates the Dock scaffold only when explicitly configured', () => {
    expect(createTrustContainer({ provider: 'dock' })).toBeInstanceOf(DockTrustContainer);
  });

  it('preserves partial limitation notes in mock credentials', async () => {
    const result = await new MockTrustContainer().issueCredential(envelope());
    const vc = result.vcPayload as { credentialSubject: CredentialEnvelopePayload };
    expect(vc.credentialSubject.status).toBe('PARTIAL');
    expect(vc.credentialSubject.proofTier).toBe('PARTIAL');
    expect(vc.credentialSubject.limitationNotes).toEqual(['Identity not strictly verified']);
  });
});
