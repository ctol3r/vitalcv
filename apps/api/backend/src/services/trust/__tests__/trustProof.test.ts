jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { buildTrustProofBundle, renderTrustProofPdf } from '../trustProof';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('trustProof', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
  });

  it('builds a deterministic redacted proof bundle from stored artifacts', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      checksum: 'snapshot-checksum',
      verifiedAt: new Date('2026-03-01T00:00:00Z'),
      rawPayload: {
        npi: '1234567890',
        readiness_level: 'L3',
        readiness_score: 91,
        methodology_version: '243.1',
        computed_at: '2026-03-01T00:00:00Z',
      },
    });
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact-1',
        npi: '1234567890',
        source: 'NURSYS',
        status: 'ACTIVE',
        rawPayload: { jurisdiction: 'CA', licenseNumber: 'A12345' },
        checksum: 'checksum-1',
        merkleRoot: null,
        claimHashes: [],
        verifiedAt: new Date('2026-02-28T12:00:00Z'),
        expiresAt: null,
        monitoring: true,
        lifecycleState: 'active',
      },
    ]);

    const first = await buildTrustProofBundle('1234567890');
    const second = await buildTrustProofBundle('1234567890');

    expect(first.artifactHash).toBe(second.artifactHash);
    expect(first.trustBand).toBe('L3');
    expect(first.readinessScore).toBe(91);
    expect(first.issuers).toEqual(['NURSYS']);
    expect(first.credentialClaims.redacted).toBe(true);
    expect(first.bundleDownloads.trustProofPdf).toContain('format=pdf');
  });

  it('renders a PDF from the canonical proof payload', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      checksum: 'snapshot-checksum',
      verifiedAt: new Date('2026-03-01T00:00:00Z'),
      rawPayload: {
        npi: '1234567890',
        readiness_level: 'L2',
        readiness_score: 76,
        methodology_version: '243.1',
        computed_at: '2026-03-01T00:00:00Z',
      },
    });
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);

    const bundle = await buildTrustProofBundle('1234567890');
    const pdf = renderTrustProofPdf(bundle);

    expect(pdf.subarray(0, 8).toString()).toContain('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(100);
  });

  it('rejects artifacts with invalid Merkle integrity', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      checksum: 'snapshot-checksum',
      verifiedAt: new Date('2026-03-01T00:00:00Z'),
      rawPayload: {
        npi: '1234567890',
        readiness_level: 'L3',
        readiness_score: 88,
        methodology_version: '243.1',
        computed_at: '2026-03-01T00:00:00Z',
      },
    });
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact-1',
        npi: '1234567890',
        source: 'NURSYS',
        status: 'ACTIVE',
        rawPayload: { jurisdiction: 'CA' },
        checksum: 'checksum-1',
        merkleRoot: 'broken-root',
        claimHashes: [],
        verifiedAt: new Date('2026-02-28T12:00:00Z'),
        expiresAt: null,
        monitoring: true,
        lifecycleState: 'active',
      },
    ]);

    await expect(buildTrustProofBundle('1234567890')).rejects.toThrow('Merkle integrity check failed');
  });
});
