import { buildPsvArtifact, SignFunction } from '../services/artifactBuilder';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';
import type { NormalizedCredentialPayload } from '../types/psv';

const mockSign: SignFunction = async (payload: string) => ({
  signature: 'mock-sig-' + sha256(payload).slice(0, 16),
  publicKeyId: 'test-key-1',
  signedAt: new Date().toISOString(),
});

function makePayload(): NormalizedCredentialPayload {
  return {
    provider: {
      npi: '1234567890',
      type: 'INDIVIDUAL',
      name: { first: 'Jane', last: 'Doe', middle: 'M', suffix: '', credential: 'MD' },
      enumerationDate: '2010-01-15',
      lastUpdated: '2024-06-01',
      status: 'ACTIVE',
    },
    credentials: [
      {
        credentialType: 'STATE_LICENSE',
        status: 'ACTIVE',
        issuer: 'Internal Medicine',
        issuingStateOrBody: 'CA',
        credentialIdentifier: 'A12345',
        issueDate: '2015-03-01',
        expirationDate: '2026-03-01',
        compactStatus: 'PRIMARY',
      },
    ],
    retrieval: {
      method: 'API',
      retrievedAt: new Date().toISOString(),
      agent: { system: 'vitalcv-engine', version: '1.0.0' },
      source: {
        sourceType: 'NPPES',
        sourceName: 'CMS NPPES',
        sourceUrl: 'https://npiregistry.cms.hhs.gov',
        authoritative: true,
      },
    },
    enrollment: {
      medicareEnrollment: { enrollmentType: 'MEDICARE', status: 'UNKNOWN', effectiveDate: '', terminationDate: '' },
      medicaidEnrollment: { enrollmentType: 'MEDICAID', status: 'UNKNOWN', effectiveDate: '', terminationDate: '' },
      stateSpecific: { CA: 'A12345' },
    },
    rawPayload: { result_count: 1, results: [{ number: 1234567890 }] },
  };
}

describe('buildPsvArtifact', () => {
  it('returns a complete artifact with all required fields', async () => {
    const { artifact } = await buildPsvArtifact(makePayload(), mockSign);

    expect(artifact.artifactId).toBeDefined();
    expect(artifact.artifactVersion).toBe('1.0');
    expect(artifact.generatedAt).toBeDefined();
    expect(artifact.provider.npi).toBe('1234567890');
    expect(artifact.credentials).toHaveLength(1);
    expect(artifact.integrity.rawPayloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.integrity.artifactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.integrity.signatureAlgorithm).toBe('ES256');
    expect(artifact.integrity.signature).toBeDefined();
    expect(artifact.decisionWindow.windowDays).toBe(120);
    expect(artifact.decisionWindow.windowStatus).toBe('WITHIN_WINDOW');
    expect(artifact.monitoring.enabled).toBe(true);
    expect(artifact.deltaLog).toEqual([]);
  });

  it('produces deterministic rawPayloadHash', async () => {
    const payload = makePayload();
    const { artifact: a1 } = await buildPsvArtifact(payload, mockSign);
    const { artifact: a2 } = await buildPsvArtifact(payload, mockSign);
    expect(a1.integrity.rawPayloadHash).toBe(a2.integrity.rawPayloadHash);
  });

  it('generates unique artifactIds', async () => {
    const payload = makePayload();
    const { artifact: a1 } = await buildPsvArtifact(payload, mockSign);
    const { artifact: a2 } = await buildPsvArtifact(payload, mockSign);
    expect(a1.artifactId).not.toBe(a2.artifactId);
  });

  it('artifact hash is computed over partial (without integrity)', async () => {
    const { artifact } = await buildPsvArtifact(makePayload(), mockSign);
    const { integrity, ...partial } = artifact;
    const recomputedHash = sha256(canonicalize(partial));
    expect(artifact.integrity.artifactHash).toBe(recomputedHash);
  });

  it('returns empty storage ref when no store function provided', async () => {
    const { rawPayloadStorageRef } = await buildPsvArtifact(makePayload(), mockSign);
    expect(rawPayloadStorageRef).toBe('');
  });

  it('calls store function and returns storage ref', async () => {
    const mockStore = jest.fn().mockResolvedValue('/storage/abc-123/raw.json');

    const { rawPayloadStorageRef, artifact } = await buildPsvArtifact(
      makePayload(),
      mockSign,
      mockStore,
    );

    expect(rawPayloadStorageRef).toBe('/storage/abc-123/raw.json');
    expect(mockStore).toHaveBeenCalledWith(
      artifact.artifactId,
      makePayload().rawPayload,
    );
  });
});
