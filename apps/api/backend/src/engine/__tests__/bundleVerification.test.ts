import { buildPsvArtifact, SignFunction } from '../services/artifactBuilder';
import {
  buildBundleContents,
  buildBundleContentsFromRecord,
  verifyBundleContents,
  createBundleZipStream,
  BundleContents,
} from '../services/bundleDownloadService';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';
import type { NormalizedCredentialPayload, PsvArtifact } from '../types/psv';

// ─── Test Fixtures ──────────────────────────────────────────

const mockSign: SignFunction = async (payload: string) => ({
  signature: 'mock-sig-' + sha256(payload).slice(0, 16),
  publicKeyId: 'test-key-1',
  signedAt: '2025-06-15T10:00:00.000Z',
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
      retrievedAt: '2025-06-15T10:00:00.000Z',
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

async function buildTestBundle(): Promise<{
  artifact: PsvArtifact;
  rawPayload: Record<string, unknown>;
  bundle: BundleContents;
}> {
  const payload = makePayload();
  const { artifact } = await buildPsvArtifact(payload, mockSign);
  const bundle = buildBundleContents(artifact, payload.rawPayload);
  return { artifact, rawPayload: payload.rawPayload, bundle };
}

// ─── Tests ──────────────────────────────────────────────────

describe('Wave 3C — Bundle Verification', () => {
  describe('buildBundleContents', () => {
    it('produces four non-empty bundle files', async () => {
      const { bundle } = await buildTestBundle();

      expect(bundle.artifactJson.length).toBeGreaterThan(0);
      expect(bundle.integrityTxt.length).toBeGreaterThan(0);
      expect(bundle.rawJson.length).toBeGreaterThan(0);
      expect(bundle.readmeTxt.length).toBeGreaterThan(0);
    });

    it('artifact.json is valid JSON', async () => {
      const { bundle } = await buildTestBundle();
      expect(() => JSON.parse(bundle.artifactJson)).not.toThrow();
    });

    it('artifact.json round-trips through canonicalize unchanged', async () => {
      const { bundle } = await buildTestBundle();
      const parsed = JSON.parse(bundle.artifactJson);
      const reCanonicalized = canonicalize(parsed);
      expect(reCanonicalized).toBe(bundle.artifactJson);
    });
  });

  describe('artifact.json canonicalization', () => {
    it('keys are sorted alphabetically at every nesting level', async () => {
      const { bundle } = await buildTestBundle();
      const parsed = JSON.parse(bundle.artifactJson) as PsvArtifact;

      function assertKeysSorted(obj: Record<string, unknown>, path: string): void {
        const keys = Object.keys(obj);
        const sorted = [...keys].sort();
        expect(keys).toEqual(sorted);

        for (const key of keys) {
          const value = obj[key];
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            assertKeysSorted(value as Record<string, unknown>, `${path}.${key}`);
          }
        }
      }

      assertKeysSorted(parsed as unknown as Record<string, unknown>, 'artifact');
    });

    it('canonicalization is idempotent', async () => {
      const { bundle } = await buildTestBundle();
      const pass1 = canonicalize(JSON.parse(bundle.artifactJson));
      const pass2 = canonicalize(JSON.parse(pass1));
      expect(pass1).toBe(pass2);
    });

    it('deterministic output for same input', async () => {
      const payload = makePayload();
      const { artifact: a1 } = await buildPsvArtifact(payload, mockSign);
      const { artifact: a2 } = await buildPsvArtifact(payload, mockSign);

      // Different artifactIds but same rawPayloadHash
      const b1 = buildBundleContents(a1, payload.rawPayload);
      const b2 = buildBundleContents(a2, payload.rawPayload);

      // rawPayloadHash should be identical (deterministic over same input)
      const p1 = JSON.parse(b1.artifactJson) as PsvArtifact;
      const p2 = JSON.parse(b2.artifactJson) as PsvArtifact;
      expect(p1.integrity.rawPayloadHash).toBe(p2.integrity.rawPayloadHash);
    });
  });

  describe('integrity.txt matches DB', () => {
    it('integrity.txt format is sha256:<hash>', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.integrityTxt).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it('integrity.txt hash matches artifact.integrity.artifactHash', async () => {
      const { bundle } = await buildTestBundle();
      const parsed = JSON.parse(bundle.artifactJson) as PsvArtifact;
      expect(bundle.integrityTxt).toBe(`sha256:${parsed.integrity.artifactHash}`);
    });

    it('artifactHash is correct (hash of partial without integrity block)', async () => {
      const { bundle } = await buildTestBundle();
      const parsed = JSON.parse(bundle.artifactJson) as PsvArtifact;
      const { integrity, ...partial } = parsed;
      const recomputedHash = sha256(canonicalize(partial));
      expect(parsed.integrity.artifactHash).toBe(recomputedHash);
    });
  });

  describe('raw.json matches stored payload', () => {
    it('raw.json is valid JSON', async () => {
      const { bundle } = await buildTestBundle();
      expect(() => JSON.parse(bundle.rawJson)).not.toThrow();
    });

    it('raw.json content matches original raw payload', async () => {
      const { bundle, rawPayload } = await buildTestBundle();
      const parsed = JSON.parse(bundle.rawJson);
      expect(parsed).toEqual(rawPayload);
    });

    it('raw.json hash matches integrity.rawPayloadHash', async () => {
      const { bundle } = await buildTestBundle();
      const parsed = JSON.parse(bundle.artifactJson) as PsvArtifact;
      const rawParsed = JSON.parse(bundle.rawJson);
      const rawHash = sha256(canonicalize(rawParsed));
      expect(rawHash).toBe(parsed.integrity.rawPayloadHash);
    });

    it('raw.json is canonicalized (compact, deterministic)', async () => {
      const { bundle } = await buildTestBundle();
      // canonicalize() produces compact JSON with sorted keys, no whitespace
      expect(bundle.rawJson).not.toContain('\n');
      const parsed = JSON.parse(bundle.rawJson);
      expect(canonicalize(parsed)).toBe(bundle.rawJson);
    });
  });

  describe('README.txt provenance fields', () => {
    it('includes Source field', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/Source:\s+CMS NPPES/);
    });

    it('includes RetrievedAt field', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/RetrievedAt:\s+\d{4}-\d{2}-\d{2}T/);
    });

    it('includes Method field', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/Method:\s+API/);
    });

    it('includes Hash Algorithm field', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/Hash Algorithm:\s+SHA-256/);
    });

    it('includes Signature Algorithm field', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/Signature Algorithm:\s+ES256/);
    });

    it('includes NCQA Window note', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/NCQA.*Window/i);
    });

    it('includes all six required fields in a single check', async () => {
      const { bundle } = await buildTestBundle();
      const required = [
        /Source:\s*.+/,
        /RetrievedAt:\s*.+/,
        /Method:\s*.+/,
        /Hash Algorithm:\s*.+/,
        /Signature Algorithm:\s*.+/,
        /NCQA.*Window/i,
      ];
      for (const pattern of required) {
        expect(bundle.readmeTxt).toMatch(pattern);
      }
    });

    it('includes artifact ID and NPI', async () => {
      const { bundle, artifact } = await buildTestBundle();
      expect(bundle.readmeTxt).toContain(artifact.artifactId);
      expect(bundle.readmeTxt).toContain('1234567890');
    });

    it('includes decision window status', async () => {
      const { bundle } = await buildTestBundle();
      expect(bundle.readmeTxt).toMatch(/Window Status:\s+(WITHIN_WINDOW|EXPIRING_SOON|EXPIRED)/);
    });
  });

  describe('verifyBundleContents — green path', () => {
    it('returns no errors for a correctly built bundle', async () => {
      const { bundle } = await buildTestBundle();
      const errors = verifyBundleContents(bundle);
      expect(errors).toEqual([]);
    });
  });

  describe('verifyBundleContents — tamper detection', () => {
    it('detects non-canonicalized artifact.json', async () => {
      const { bundle, artifact } = await buildTestBundle();

      // Re-serialize with unsorted keys
      const tampered: BundleContents = {
        ...bundle,
        artifactJson: JSON.stringify(artifact), // not canonicalized (key order differs)
      };

      const errors = verifyBundleContents(tampered);
      expect(errors.some((e) => e.includes('not canonicalized'))).toBe(true);
    });

    it('detects integrity.txt mismatch', async () => {
      const { bundle } = await buildTestBundle();

      const tampered: BundleContents = {
        ...bundle,
        integrityTxt: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      };

      const errors = verifyBundleContents(tampered);
      expect(errors.some((e) => e.includes('integrity.txt mismatch'))).toBe(true);
    });

    it('detects raw.json payload tampering', async () => {
      const { bundle } = await buildTestBundle();

      const tampered: BundleContents = {
        ...bundle,
        rawJson: JSON.stringify({ tampered: true }),
      };

      const errors = verifyBundleContents(tampered);
      expect(errors.some((e) => e.includes('rawPayloadHash mismatch'))).toBe(true);
    });

    it('detects missing README fields', async () => {
      const { bundle } = await buildTestBundle();

      const tampered: BundleContents = {
        ...bundle,
        readmeTxt: 'This is an empty README with no provenance fields.',
      };

      const errors = verifyBundleContents(tampered);
      expect(errors.length).toBeGreaterThanOrEqual(6);
      expect(errors.some((e) => e.includes('Source'))).toBe(true);
      expect(errors.some((e) => e.includes('RetrievedAt'))).toBe(true);
      expect(errors.some((e) => e.includes('Method'))).toBe(true);
      expect(errors.some((e) => e.includes('Hash Algorithm'))).toBe(true);
      expect(errors.some((e) => e.includes('Signature Algorithm'))).toBe(true);
      expect(errors.some((e) => e.includes('NCQA Window'))).toBe(true);
    });

    it('detects artifactHash recomputation mismatch', async () => {
      const { artifact, rawPayload } = await buildTestBundle();

      // Corrupt the integrity block's artifactHash
      const corrupted: PsvArtifact = {
        ...artifact,
        integrity: {
          ...artifact.integrity,
          artifactHash: 'aaaa' + artifact.integrity.artifactHash.slice(4),
        },
      };

      const corruptedBundle = buildBundleContents(corrupted, rawPayload);
      const errors = verifyBundleContents(corruptedBundle);
      expect(errors.some((e) => e.includes('artifactHash mismatch'))).toBe(true);
    });
  });

  describe('createBundleZipStream', () => {
    it('produces a readable stream with zip content', async () => {
      const { bundle } = await buildTestBundle();
      const stream = createBundleZipStream(bundle, '1234567890');

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const zipBuffer = Buffer.concat(chunks);

      // ZIP files start with PK\x03\x04 magic bytes
      expect(zipBuffer[0]).toBe(0x50); // P
      expect(zipBuffer[1]).toBe(0x4b); // K
      expect(zipBuffer.length).toBeGreaterThan(100);
    });

    it('zip contains all four expected files', async () => {
      const { bundle } = await buildTestBundle();
      const stream = createBundleZipStream(bundle, '1234567890');

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const zipBuffer = Buffer.concat(chunks);
      const zipString = zipBuffer.toString('binary');

      // Check that filenames appear in the zip central directory
      expect(zipString).toContain('artifact.json');
      expect(zipString).toContain('integrity.txt');
      expect(zipString).toContain('raw.json');
      expect(zipString).toContain('README.txt');
    });

    it('zip filenames are prefixed with psv-bundle-{npi}/', async () => {
      const { bundle } = await buildTestBundle();
      const stream = createBundleZipStream(bundle, '1234567890');

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const zipBuffer = Buffer.concat(chunks);
      const zipString = zipBuffer.toString('binary');

      expect(zipString).toContain('psv-bundle-1234567890/artifact.json');
      expect(zipString).toContain('psv-bundle-1234567890/integrity.txt');
    });
  });

  describe('buildBundleContentsFromRecord', () => {
    it('produces a valid bundle from DB-shaped data', () => {
      const verifiedAt = new Date('2025-06-15T10:00:00.000Z');
      const record = {
        npi: '1234567890',
        artifact: {
          id: 'art-001',
          source: 'NURSYS',
          status: 'ACTIVE',
          checksum: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          verifiedAt,
          expiresAt: new Date('2026-03-01T00:00:00.000Z'),
          monitoring: true,
        },
        auditMetadata: {
          source: 'NURSYS',
          timestamp: '2025-06-15T10:05:00.000Z',
          verifierIdentity: 'VitalCV Cross-Check Engine v1',
          checksum: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          methodology: 'Primary source verification via Nursys E-Notify simulation',
          monitoringStatus: 'ACTIVE_MONITORING',
        },
        snapshotId: 'snap-001',
      };

      const rawPayload = { result_count: 1, results: [{ number: 1234567890 }] };
      const bundle = buildBundleContentsFromRecord(record, rawPayload);

      expect(bundle.artifactJson.length).toBeGreaterThan(0);
      expect(bundle.integrityTxt).toBe(`sha256:${record.artifact.checksum}`);
      expect(JSON.parse(bundle.rawJson)).toEqual(rawPayload);
    });

    it('artifact.json from record is canonicalized', () => {
      const verifiedAt = new Date('2025-06-15T10:00:00.000Z');
      const record = {
        npi: '9876543210',
        artifact: {
          id: 'art-002',
          source: 'NPPES',
          status: 'ACTIVE',
          checksum: 'deadbeef'.repeat(8),
          verifiedAt,
          expiresAt: null,
          monitoring: false,
        },
        auditMetadata: {
          source: 'NPPES',
          timestamp: new Date().toISOString(),
          verifierIdentity: 'VitalCV Cross-Check Engine v1',
          checksum: 'deadbeef'.repeat(8),
          methodology: 'Primary source verification',
          monitoringStatus: 'STANDARD',
        },
        snapshotId: 'snap-002',
      };

      const bundle = buildBundleContentsFromRecord(record, {});
      const parsed = JSON.parse(bundle.artifactJson);
      const reCanonicalized = canonicalize(parsed);
      expect(reCanonicalized).toBe(bundle.artifactJson);
    });

    it('README from record includes all required provenance fields', () => {
      const verifiedAt = new Date('2025-06-15T10:00:00.000Z');
      const record = {
        npi: '1234567890',
        artifact: {
          id: 'art-003',
          source: 'NURSYS',
          status: 'ACTIVE',
          checksum: 'a'.repeat(64),
          verifiedAt,
          expiresAt: new Date('2026-03-01T00:00:00.000Z'),
          monitoring: true,
        },
        auditMetadata: {
          source: 'NURSYS',
          timestamp: new Date().toISOString(),
          verifierIdentity: 'VitalCV Cross-Check Engine v1',
          checksum: 'a'.repeat(64),
          methodology: 'Primary source verification via Nursys E-Notify simulation',
          monitoringStatus: 'ACTIVE_MONITORING',
        },
        snapshotId: 'snap-003',
      };

      const bundle = buildBundleContentsFromRecord(record, {});
      const readme = bundle.readmeTxt;

      expect(readme).toMatch(/Source:\s*.+/);
      expect(readme).toMatch(/RetrievedAt:\s*.+/);
      expect(readme).toMatch(/Method:\s*.+/);
      expect(readme).toMatch(/Hash Algorithm:\s+SHA-256/);
      expect(readme).toMatch(/Signature Algorithm:\s+ES256/);
      expect(readme).toMatch(/NCQA.*Window/i);
    });
  });

  describe('end-to-end: build → verify round-trip', () => {
    it('a freshly built bundle passes all verification checks', async () => {
      const payload = makePayload();
      const { artifact } = await buildPsvArtifact(payload, mockSign);
      const bundle = buildBundleContents(artifact, payload.rawPayload);
      const errors = verifyBundleContents(bundle);
      expect(errors).toEqual([]);
    });

    it('verification catches multiple simultaneous corruptions', async () => {
      const { bundle } = await buildTestBundle();

      const corrupted: BundleContents = {
        artifactJson: '{"wrong":"data"}',
        integrityTxt: 'sha256:0000',
        rawJson: '{"tampered":true}',
        readmeTxt: 'No provenance here.',
      };

      const errors = verifyBundleContents(corrupted);
      // Should catch: non-canonical, integrity mismatch, raw hash mismatch, missing README fields
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});
