import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { evaluateRenewalCriteriaV2 } from '../renewalEngineV2';

const mockPrivilegeFindUnique = jest.fn();
const mockCredentialFindMany = jest.fn();
const mockFppeFindFirst = jest.fn();
const mockScheduleFindUnique = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      privilegeGranted: { findUnique: mockPrivilegeFindUnique },
      credential: { findMany: mockCredentialFindMany },
      fppeOppe: { findFirst: mockFppeFindFirst },
      oPPEScheduleV2: { findUnique: mockScheduleFindUnique },
    })),
  };
});

describe('renewalEngineV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupHappyPath() {
    mockPrivilegeFindUnique.mockResolvedValue({
      id: 'priv-1',
      orgId: 'org-1',
      clinicianDid: 'did:example:123',
      privilegeRequestId: 'req-1',
      privilegeRequest: {
        evidenceIds: ['cred-1', 'cred-2', 'cred-3'],
      },
      oppeCases: [
        {
          id: 'case-1',
          status: 'COMPLETED',
          metrics: { caseCount: 12 },
        },
      ],
    });

    mockCredentialFindMany.mockResolvedValue([
      { id: 'cred-1', type: 'BoardCertification', status: 'active', expiresAt: new Date(Date.now() + 100000000) },
      { id: 'cred-2', type: 'MedicalLicense', status: 'active', expiresAt: new Date(Date.now() + 100000000) },
      { id: 'cred-3', type: 'DEARegistration', status: 'active', expiresAt: new Date(Date.now() + 100000000) },
    ]);

    mockFppeFindFirst.mockResolvedValue({ fppeStatus: 'COMPLETED' });
    mockScheduleFindUnique.mockResolvedValue({ metricsConfig: { cases: 10 } });
  }

  it('passes when all checks meet criteria', async () => {
    setupHappyPath();
    const result = await evaluateRenewalCriteriaV2('priv-1');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('fails when OPPE case missing targets', async () => {
    setupHappyPath();
    mockPrivilegeFindUnique.mockResolvedValueOnce({
      id: 'priv-1',
      orgId: 'org-1',
      clinicianDid: 'did:example:123',
      privilegeRequestId: 'req-1',
      privilegeRequest: {
        evidenceIds: ['cred-1', 'cred-2', 'cred-3'],
      },
      oppeCases: [
        {
          id: 'case-1',
          status: 'COMPLETED',
          metrics: { caseCount: 2 },
        },
      ],
    });
    mockScheduleFindUnique.mockResolvedValue({ metricsConfig: { cases: 10 } });

    const result = await evaluateRenewalCriteriaV2('priv-1');
    const oppeCheck = result.checks.find((c) => c.name === 'OPPE Performance');
    expect(oppeCheck?.met).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('fails when DEA credential missing', async () => {
    setupHappyPath();
    mockCredentialFindMany.mockResolvedValueOnce([
      { id: 'cred-1', type: 'BoardCertification', status: 'active' },
      { id: 'cred-2', type: 'MedicalLicense', status: 'active' },
    ]);

    const result = await evaluateRenewalCriteriaV2('priv-1');
    const deaCheck = result.checks.find((c) => c.name === 'DEA Registration');
    expect(deaCheck?.met).toBe(false);
    expect(result.passed).toBe(false);
  });
});
