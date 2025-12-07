process.env.NCI_FEDERATED_NODES = '[]';

import request from 'supertest';
import express from 'express';

const mockPrisma = {
  clinicianProfile: {
    findFirst: jest.fn(),
  },
  stateLicenseVerification: {
    findMany: jest.fn(),
  },
  privilegeGranted: {
    findMany: jest.fn(),
  },
  payerEnrollmentV2: {
    findMany: jest.fn(),
  },
  ehrSynchronization: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    Prisma: actual.Prisma,
  };
});

const runFederatedLookup = jest.fn();
jest.mock('../../../../../services/nci/federatedLookup', () => ({
  runFederatedLookup: (...args: unknown[]) => runFederatedLookup(...args),
}));

const buildLicenseProof = jest.fn();
const buildPrivilegeProof = jest.fn();
const buildEnrollmentProof = jest.fn();
jest.mock('../../../../../services/nci/proofBuilders/licenseProofBuilder', () => ({
  buildLicenseProof: (...args: unknown[]) => buildLicenseProof(...args),
}));
jest.mock('../../../../../services/nci/proofBuilders/privilegeProofBuilder', () => ({
  buildPrivilegeProof: (...args: unknown[]) => buildPrivilegeProof(...args),
}));
jest.mock('../../../../../services/nci/proofBuilders/enrollmentProofBuilder', () => ({
  buildEnrollmentProof: (...args: unknown[]) => buildEnrollmentProof(...args),
}));

const getCredentialRiskSummary = jest.fn();
const getPecosSummaryForClinician = jest.fn();
const getCompactEvidenceSummaries = jest.fn();
jest.mock('../../../../../services/psv/evidenceBundle', () => ({
  getCredentialRiskSummary: (...args: unknown[]) => getCredentialRiskSummary(...args),
  getPecosSummaryForClinician: (...args: unknown[]) => getPecosSummaryForClinician(...args),
  getCompactEvidenceSummaries: (...args: unknown[]) => getCompactEvidenceSummaries(...args),
}));

const evaluatePrivilegeEligibility = jest.fn();
jest.mock('../../../../../services/privyDep/eligibilityEngine', () => ({
  evaluatePrivilegeEligibility: (...args: unknown[]) => evaluatePrivilegeEligibility(...args),
}));

import clinicianRouter from '../clinician';

describe('GET /nci/clinician/:npi', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.clinicianProfile.findFirst.mockResolvedValue({
      id: 'clin-1',
      npi: '1234567890',
      user: { did: 'did:example:123', name: 'Dr. Example' },
      specialty: 'Cardiology',
      state: 'CA',
      orgId: 'org-1',
      caqhProfiles: [],
    });
    mockPrisma.stateLicenseVerification.findMany.mockResolvedValue([
      {
        state: 'CA',
        licenseNumber: 'A1234',
        status: 'ACTIVE',
        issueDate: new Date('2020-01-01T00:00:00Z'),
        expiryDate: new Date('2026-01-01T00:00:00Z'),
        disciplinaryFlag: false,
        source: 'ca_board',
        verifiedAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        metadata: null,
      },
    ]);
    mockPrisma.privilegeGranted.findMany.mockResolvedValue([
      {
        id: 'priv-1',
        privilegeSetId: 'set-1',
        status: 'ACTIVE',
        grantedAt: new Date('2024-01-01T00:00:00Z'),
        expiresAt: new Date('2025-01-01T00:00:00Z'),
        renewalDue: new Date('2024-12-01T00:00:00Z'),
        reviewerDid: 'did:example:reviewer',
        orgId: 'hospital-1',
        privilegeRequest: {
          privilegeSet: {
            privilegeCodes: ['CARD-CATH'],
          },
        },
      },
    ]);
    mockPrisma.payerEnrollmentV2.findMany.mockResolvedValue([
      {
        id: 'enroll-1',
        payerId: 'payer-1',
        status: 'ACTIVE',
        panelType: 'PAR',
        effectiveDate: new Date('2022-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        lastStatusChange: new Date('2024-12-15T00:00:00Z'),
        metadata: null,
        payer: {
          name: 'Payer One',
          states: ['CA'],
          specialty: ['Cardiology'],
          planTypes: ['Commercial'],
        },
      },
    ]);
    mockPrisma.ehrSynchronization.findMany.mockResolvedValue([
      {
        privilegeSetId: 'set-1',
        status: 'SYNCED',
        lastAttemptAt: new Date('2025-01-05T00:00:00Z'),
        metadata: null,
      },
    ]);

    runFederatedLookup.mockResolvedValue({
      nodes: [],
      aggregated: {
        licenseRecords: [],
        privilegeRecords: [],
        enrollmentRecords: [],
        trustAnchors: [],
      },
    });
    buildLicenseProof.mockResolvedValue({ type: 'license-proof' });
    buildPrivilegeProof.mockResolvedValue({ type: 'privilege-proof' });
    buildEnrollmentProof.mockResolvedValue({ type: 'enrollment-proof' });
    getCredentialRiskSummary.mockResolvedValue({
      clinicianId: 'clin-1',
      score: 42,
      factors: ['LICENSE_EXPIRED'],
      updatedAt: '2025-01-01T00:00:00Z',
    });
    getPecosSummaryForClinician.mockResolvedValue({
      clinicianId: 'clin-1',
      provider: {
        providerId: 'pecos-1',
        status: 'APPROVED',
        lastCheckedAt: '2025-01-01T00:00:00Z',
      },
      documents: [],
      enrollments: [],
    });
    getCompactEvidenceSummaries.mockResolvedValue([]);
    evaluatePrivilegeEligibility.mockResolvedValue({
      clinicianId: 'clin-1',
      privilegeCode: 'CARD-CATH',
      eligible: true,
      missingPrereqs: [],
      conflicts: [],
      evaluatedAt: new Date(),
      graphDepth: 1,
    });

    app = express();
    app.use(express.json());
    app.use('/nci', clinicianRouter);
  });

  it('returns clinician summary payload', async () => {
    const response = await request(app).get('/nci/clinician/1234567890');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.licenseSummary.total).toBe(1);
    expect(response.body.privilegeSummary.total).toBe(1);
    expect(response.body.enrollmentSummary.total).toBe(1);
    expect(response.body.proofs.license).toEqual({ type: 'license-proof' });
    expect(buildLicenseProof).toHaveBeenCalled();
    expect(buildPrivilegeProof).toHaveBeenCalled();
    expect(buildEnrollmentProof).toHaveBeenCalled();
  });

  it('returns 404 when clinician not found', async () => {
    mockPrisma.clinicianProfile.findFirst.mockResolvedValueOnce(null);

    const response = await request(app).get('/nci/clinician/999');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('clinician_not_found');
  });
});

