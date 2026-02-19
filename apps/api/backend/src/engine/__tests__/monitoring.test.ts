import { generateKeyPairSync } from 'crypto';
import type { Credential, PsvArtifact, NormalizedCredentialPayload } from '../types/psv';
import { detectMaterialChange, runMonitoringCheck } from '../services/monitoringEngine';
import { buildPsvArtifact } from '../services/artifactBuilder';
import { signArtifact, _resetKeyCache } from '../services/signingService';
import { sha256 } from '../utils/hash';

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
    credentials: credentials || [makeCredential()],
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
      stateSpecific: {},
    },
    rawPayload: { result_count: 1 },
  };
}

describe('detectMaterialChange', () => {
  it('detects no change for identical credentials', () => {
    const cred = makeCredential();
    const result = detectMaterialChange([cred], [cred]);
    expect(result.materialChange).toBe(false);
    expect(result.changedFields).toHaveLength(0);
  });

  it('detects status change', () => {
    const old = makeCredential({ status: 'ACTIVE' });
    const changed = makeCredential({ status: 'EXPIRED' });
    const result = detectMaterialChange([old], [changed]);
    expect(result.materialChange).toBe(true);
    expect(result.changedFields).toHaveLength(1);
    expect(result.changedFields[0].field).toBe('credentials[0].status');
    expect(result.changedFields[0].previousValue).toBe('ACTIVE');
    expect(result.changedFields[0].newValue).toBe('EXPIRED');
  });

  it('detects expiration date change', () => {
    const old = makeCredential({ expirationDate: '2026-03-01' });
    const changed = makeCredential({ expirationDate: '2027-03-01' });
    const result = detectMaterialChange([old], [changed]);
    expect(result.materialChange).toBe(true);
    expect(result.changedFields[0].field).toContain('expirationDate');
  });

  it('detects added credential', () => {
    const old = [makeCredential()];
    const changed = [makeCredential(), makeCredential({ credentialType: 'BOARD_CERTIFICATION' })];
    const result = detectMaterialChange(old, changed);
    expect(result.materialChange).toBe(true);
  });

  it('produces unique change hash per change set', () => {
    const old = makeCredential({ status: 'ACTIVE' });
    const r1 = detectMaterialChange([old], [makeCredential({ status: 'EXPIRED' })]);
    const r2 = detectMaterialChange([old], [makeCredential({ status: 'SUSPENDED' })]);
    expect(r1.changeHash).not.toBe(r2.changeHash);
  });
});

describe('runMonitoringCheck', () => {
  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env['PSV_SIGNING_PRIVATE_KEY'] = privateKey as string;
    process.env['PSV_SIGNING_PUBLIC_KEY'] = publicKey as string;
    process.env['PSV_SIGNING_KID'] = 'test-key-1';
    _resetKeyCache();
  });

  it('returns unchanged artifact when no material change', async () => {
    const payload = makePayload();
    const { artifact: existing } = await buildPsvArtifact(payload, signArtifact);
    const result = await runMonitoringCheck(existing, payload, signArtifact);

    expect(result.changed).toBe(false);
    expect(result.deltaEntry).toBeNull();
    expect(result.artifact.integrity.artifactHash).toBe(existing.integrity.artifactHash);
  });

  it('builds new artifact with delta when status changes', async () => {
    const originalPayload = makePayload([makeCredential({ status: 'ACTIVE' })]);
    const { artifact: existing } = await buildPsvArtifact(originalPayload, signArtifact);

    const changedPayload = makePayload([makeCredential({ status: 'EXPIRED' })]);
    const result = await runMonitoringCheck(existing, changedPayload, signArtifact);

    expect(result.changed).toBe(true);
    expect(result.deltaEntry).not.toBeNull();
    expect(result.deltaEntry!.changeSet.materialChange).toBe(true);
    expect(result.deltaEntry!.previousArtifactHash).toBe(existing.integrity.artifactHash);
    expect(result.artifact.deltaLog).toHaveLength(1);
  });
});
