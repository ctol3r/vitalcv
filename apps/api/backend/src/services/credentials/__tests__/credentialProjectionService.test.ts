jest.mock('../../../graphql/prisma_client', () => ({
  default: {
    verificationArtifact: { findMany: jest.fn() },
    npiDidBinding: { findUnique: jest.fn() },
    candidateCredential: { findMany: jest.fn() },
    issuedCredentialRecord: { findMany: jest.fn() },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { projectCredentials } from '../credentialProjectionService';

const NOW = new Date('2026-07-30T12:00:00.000Z');

describe('projectCredentials', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(prisma.verificationArtifact.findMany).mockResolvedValue([]);
    jest.mocked(prisma.npiDidBinding.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.candidateCredential.findMany).mockResolvedValue([]);
    jest.mocked(prisma.issuedCredentialRecord.findMany).mockResolvedValue([]);
  });

  it('keeps source artifacts source-backed and carries claims, receipts and limitations', async () => {
    jest.mocked(prisma.verificationArtifact.findMany).mockResolvedValue([{
      id: '4b6f0000-0000-4000-8000-000000000001',
      npi: '1558302470',
      source: 'NPPES',
      status: 'active',
      verifiedAt: NOW,
      expiresAt: null,
      trustState: 'source_backed',
      lifecycleState: 'active',
      revokedAt: null,
      suspendedAt: null,
      artifactType: 'NPPES_IDENTITY',
      trustTier: 'T1',
      confidenceScore: 0.99,
      conflictReason: null,
      sourceUrl: 'https://npiregistry.cms.hhs.gov/',
      fetchedAt: NOW,
      observedAt: NOW,
      claimRecords: [{
        id: '4b6f0000-0000-4000-8000-000000000002',
        reviewRequired: false,
        reviewReason: null,
      }],
      verificationReceiptRecords: [{ receiptId: 'receipt-1' }],
    }] as never);

    const projected = await projectCredentials({ npi: '1558302470' }, NOW);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      provenance: 'source_backed',
      credentialType: 'NPPES_IDENTITY',
      status: 'active',
      sourceId: 'NPPES',
      claimRecordIds: ['4b6f0000-0000-4000-8000-000000000002'],
      receiptIds: ['receipt-1'],
      limitations: [],
    });
  });

  it('never promotes a CandidateCredential into source-backed output', async () => {
    jest.mocked(prisma.candidateCredential.findMany).mockResolvedValue([{
      id: '4b6f0000-0000-4000-8000-000000000003',
      candidateCredentialId: 'candidate-1',
      clinicianId: 'clinician-1',
      data: { credentialType: 'BOARD_CERT', provenance: 'clinician_approved', npi: '1558302470' },
      status: 'VERIFIED',
      createdAt: NOW,
    }] as never);

    const projected = await projectCredentials({ npi: '1558302470', clinicianId: 'clinician-1' }, NOW);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      provenance: 'clinician_approved',
      status: 'needs_review',
      credentialType: 'BOARD_CERT',
    });
    expect(projected[0].limitations).toContain('Clinician-provided record; not primary-source-verified.');
  });

  it('projects signed records only through the NPI-to-DID binding', async () => {
    jest.mocked(prisma.npiDidBinding.findUnique).mockResolvedValue({ did: 'did:vcv:npi:1558302470' } as never);
    jest.mocked(prisma.issuedCredentialRecord.findMany).mockResolvedValue([{
      id: '4b6f0000-0000-4000-8000-000000000004',
      credentialId: 'credential-1',
      issuerDid: 'did:example:board',
      holderDid: 'did:vcv:npi:1558302470',
      credentialType: 'STATE_LICENSE',
      format: 'vc+sd-jwt',
      kid: 'board-key-1',
      statusReference: 'https://issuer.example/status/1',
      issuedAt: NOW,
      expiresAt: new Date('2027-07-30T12:00:00.000Z'),
      revokedAt: null,
      status: 'ACTIVE',
    }] as never);

    const projected = await projectCredentials({ npi: '1558302470' }, NOW);
    expect(prisma.issuedCredentialRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { holderDid: 'did:vcv:npi:1558302470' },
    }));
    expect(projected[0]).toMatchObject({
      provenance: 'issuer_signed',
      status: 'active',
      issuerDid: 'did:example:board',
    });
  });

  it('rejects invalid NPI input rather than guessing a subject', async () => {
    await expect(projectCredentials({ npi: '123' }, NOW)).rejects.toThrow(/10 digits/);
    expect(prisma.verificationArtifact.findMany).not.toHaveBeenCalled();
  });
});
