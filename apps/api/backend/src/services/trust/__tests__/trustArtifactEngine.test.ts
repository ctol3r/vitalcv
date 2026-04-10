import { generatePSVArtifact, attachArtifactToApplication, calculateTrustScore, generateOutputLayer, generateHumanOutput } from '../trustArtifactEngine';
import prisma from '../../../graphql/prisma_client';

jest.mock('../../../graphql/prisma_client', () => {
  return {
    __esModule: true,
    default: {
      auditEvent: {
        create: jest.fn()
      },
      application: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'app1', npi: '123', artifacts: [] }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'app1', artifacts: data.artifacts }))
      }
    }
  };
});

describe('Trust Artifact Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generatePSVArtifact creates checksum and validity', () => {
    const artifact = generatePSVArtifact({
      source: 'NPPES',
      subjectId: '1234567890',
      rawPayload: { name: 'Macie' },
      sourceUrl: 'https://npiregistry.cms.hhs.gov',
      verificationMethod: 'api'
    });

    expect(artifact.checksum).toBeDefined();
    expect(artifact.status).toBe('valid');
    expect(artifact.expiresAt).toBeDefined();
    expect(artifact.source).toBe('NPPES');
  });

  test('attachArtifactToApplication writes audit log and appends artifact', async () => {
    const artifact = generatePSVArtifact({
      source: 'NPPES',
      subjectId: '1234567890',
      rawPayload: { name: 'Macie' },
      sourceUrl: 'https://npiregistry.cms.hhs.gov',
      verificationMethod: 'api'
    });

    await attachArtifactToApplication('app1', artifact);

    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'app1' },
      data: expect.objectContaining({
        artifacts: expect.arrayContaining([expect.objectContaining({ id: artifact.id })])
      })
    }));

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'artifact_created',
        metadata: expect.objectContaining({
          entity_type: 'application',
          action: 'artifact_created',
          artifact_id: artifact.id
        })
      })
    }));
  });

  test('calculateTrustScore reflects missing data correctly', () => {
    const app = {
      progress: {
        identity: 'complete',
        sanctions: 'complete',
        licensure: 'missing'
      },
      artifacts: []
    };

    const score = calculateTrustScore(app);
    expect(score).toBe(70); // 100 - 30 for licensure
  });

  test('human output formats correctly', () => {
    const app = {
      progress: {
        identity: 'complete',
        sanctions: 'complete',
        licensure: 'missing'
      }
    };

    const output = generateHumanOutput(app);
    expect(output).toBe('Identity verified. Sanctions clear. Licensure missing. Estimated 21 days to start.');
  });
});
