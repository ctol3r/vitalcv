/**
 * Unit tests for enrollment requirements engine
 * B137A-ENROLL-010: Tests for checkEnrollmentRequirements and validation logic
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MOCK_CAQH_PROFILE } from '../caqhClient.js';
import { buildCaqhFieldsFromProfile } from '../models/CAQHProfile.js';
import type { PayerRecord } from '../models/Payer.js';
import type { RequirementDefinition } from '../models/PayerRequirements.js';
import { MOCK_PECOS_STATUS_APPROVED } from '../pecosClient.js';
import {
  checkEnrollmentRequirements,
  getRequirementsSummary,
  type EnrollmentRequirementsCheck,
} from '../requirementsEngine.js';

// Mock Prisma
type NpdbOigMonitorRecord = {
  id: string;
  clinicianDid: string;
  npi: string;
  monitorType: string;
  checkDate: Date;
  status: string;
  adverseActions: any[];
  privilegeAction: string | null;
  notificationSent: boolean;
  orgIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

const mockFindFirst = jest.fn<(...args: any[]) => Promise<NpdbOigMonitorRecord | null>>();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      npdbOigMonitor: {
        findFirst: mockFindFirst,
      },
    })),
  };
});

describe('Requirements Engine', () => {
  const mockPayer: PayerRecord = {
    id: 'payer-1',
    payerId: 'TEST_PAYER',
    name: 'Test Payer',
    planTypes: ['HMO', 'PPO'],
    enrollmentEndpoint: 'https://example.com/enroll',
    x12SubmitEndpoint: null,
    contactInfo: null,
    requiresCaqh: true,
    requiresPecos: false,
    specialty: [],
    states: [],
    metadata: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseCheck: EnrollmentRequirementsCheck = {
    payerId: 'payer-1',
    clinicianDid: 'did:example:123',
    specialty: '207R00000X',
    state: 'CA',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkEnrollmentRequirements', () => {
    it('should pass all requirements with valid CAQH profile', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'npdb-1',
        clinicianDid: 'did:example:123',
        npi: '1234567890',
        monitorType: 'NPDB',
        checkDate: new Date(),
        status: 'CLEAN',
        adverseActions: [],
        privilegeAction: null,
        notificationSent: false,
        orgIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      expect(result.overallStatus).toBe('PASS');
      expect(result.eligibleForEnrollment).toBe(true);
      expect(result.criticalFailures).toHaveLength(0);
      expect(result.results.some((r) => r.requirement === 'CAQH ProView Profile')).toBe(true);
      expect(result.results.find((r) => r.requirement === 'CAQH ProView Profile')?.status).toBe(
        'PASS',
      );
    });

    it('should fail if CAQH is required but not provided', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await checkEnrollmentRequirements(baseCheck, mockPayer);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.eligibleForEnrollment).toBe(false);
      expect(result.criticalFailures.length).toBeGreaterThan(0);
      expect(result.criticalFailures.some((f) => f.includes('CAQH'))).toBe(true);
    });

    it('should pass PECOS requirement when provided and valid', async () => {
      mockFindFirst.mockResolvedValue(null);

      const payerWithPecos: PayerRecord = {
        ...mockPayer,
        requiresPecos: true,
      };

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
        pecosStatus: MOCK_PECOS_STATUS_APPROVED,
      };

      const result = await checkEnrollmentRequirements(check, payerWithPecos);

      const pecosResult = result.results.find((r) => r.requirement === 'PECOS Enrollment');
      expect(pecosResult).toBeDefined();
      expect(pecosResult?.status).toBe('PASS');
    });

    it('should fail if PECOS is required but not provided', async () => {
      mockFindFirst.mockResolvedValue(null);

      const payerWithPecos: PayerRecord = {
        ...mockPayer,
        requiresPecos: true,
      };

      const result = await checkEnrollmentRequirements(baseCheck, payerWithPecos);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.eligibleForEnrollment).toBe(false);
      expect(result.criticalFailures.some((f) => f.includes('PECOS'))).toBe(true);
    });

    it('should pass specialty requirement when payer accepts all specialties', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        specialty: '999999999X', // Non-standard specialty
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      const specialtyResult = result.results.find((r) => r.requirement === 'Specialty Match');
      expect(specialtyResult?.status).toBe('PASS');
    });

    it('should fail specialty requirement when not supported', async () => {
      mockFindFirst.mockResolvedValue(null);

      const restrictivePayer: PayerRecord = {
        ...mockPayer,
        specialty: ['207R00000X'], // Only Internal Medicine
      };

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        specialty: '208D00000X', // General Practice
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, restrictivePayer);

      expect(result.eligibleForEnrollment).toBe(false);
      expect(result.criticalFailures.some((f) => f.includes('Specialty'))).toBe(true);
    });

    it('should pass state requirement when payer operates nationwide', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        state: 'TX',
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      const stateResult = result.results.find((r) => r.requirement === 'State Coverage');
      expect(stateResult?.status).toBe('PASS');
    });

    it('should fail state requirement when payer does not operate in state', async () => {
      mockFindFirst.mockResolvedValue(null);

      const regionalPayer: PayerRecord = {
        ...mockPayer,
        states: ['CA', 'OR', 'WA'],
      };

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        state: 'NY',
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, regionalPayer);

      expect(result.eligibleForEnrollment).toBe(false);
      expect(result.criticalFailures.some((f) => f.includes('does not operate in NY'))).toBe(true);
    });

    it('should handle NPDB adverse action', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'npdb-1',
        clinicianDid: 'did:example:123',
        npi: '1234567890',
        monitorType: 'NPDB',
        checkDate: new Date(),
        status: 'ADVERSE_ACTION',
        adverseActions: [{ type: 'malpractice', date: '2023-01-01' }],
        privilegeAction: 'SUSPEND',
        notificationSent: true,
        orgIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      expect(result.eligibleForEnrollment).toBe(false);
      expect(result.criticalFailures.some((f) => f.includes('NPDB'))).toBe(true);
    });

    it('should include active license check with CAQH profile', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      const licenseResult = result.results.find((r) => r.requirement === 'Active Medical License');
      expect(licenseResult).toBeDefined();
    });

    it('should include malpractice insurance check with CAQH profile', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      const insuranceResult = result.results.find((r) => r.requirement === 'Malpractice Insurance');
      expect(insuranceResult).toBeDefined();
    });
    it('supports persisted CAQH field snapshots without full profile payload', async () => {
      mockFindFirst.mockResolvedValue(null);

      const caqhFields = buildCaqhFieldsFromProfile(MOCK_CAQH_PROFILE, 'clinician-123');
      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhFields,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);

      expect(result.overallStatus).toBe('PASS');
      expect(
        result.results.find((r) => r.requirement === 'CAQH ProView Profile')?.status
      ).toBe('PASS');
    });

  });

  describe('template requirement evaluations', () => {
    const templateRequirements: RequirementDefinition[] = [
      {
        id: 'state-license',
        type: 'STATE_LICENSE',
        label: 'California License',
        description: 'Must maintain an active CA license',
        severity: 'critical',
        metadata: { state: 'CA' },
      },
      {
        id: 'dea',
        type: 'DEA_REGISTRATION',
        label: 'DEA Registration',
        description: 'Clinician must hold DEA certificate',
        severity: 'high',
      },
      {
        id: 'malpractice',
        type: 'MALPRACTICE',
        label: 'Malpractice Coverage',
        description: 'Minimum $1M coverage',
        severity: 'medium',
        metadata: { minCoverage: 1000000 },
      },
    ];

    it('marks template requirements as PASS when criteria met', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
        payerRequirements: templateRequirements,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);
      const templateLabels = result.results
        .filter((r) => r.source === 'template')
        .map((r) => r.requirement);

      expect(templateLabels).toEqual(
        expect.arrayContaining(['California License', 'DEA Registration', 'Malpractice Coverage'])
      );
      expect(
        result.results.find((r) => r.requirement === 'DEA Registration')?.status
      ).toBe('PASS');
    });

    it('flags template DEA requirement when no DEA license present', async () => {
      mockFindFirst.mockResolvedValue(null);

      const caqhWithoutDea = {
        ...MOCK_CAQH_PROFILE,
        profile: {
          ...MOCK_CAQH_PROFILE.profile,
          licenses: MOCK_CAQH_PROFILE.profile.licenses.filter(
            (lic) => !lic.licenseType.toUpperCase().includes('DEA')
          ),
        },
      };

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: caqhWithoutDea,
        payerRequirements: templateRequirements,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);
      const deaRequirement = result.results.find((r) => r.requirement === 'DEA Registration');
      expect(deaRequirement?.status).toBe('FAIL');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('evaluates PECOS template requirement separately from payer flag', async () => {
      mockFindFirst.mockResolvedValue(null);

      const definitions: RequirementDefinition[] = [
        {
          id: 'pecos-template',
          type: 'PECOS_ENROLLMENT',
          label: 'PECOS Approval',
          description: 'Payer requires PECOS even if base configuration does not',
          severity: 'high',
        },
      ];

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
        payerRequirements: definitions,
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);
      const templateResult = result.results.find((r) => r.requirement === 'PECOS Approval');
      expect(templateResult?.status).toBe('FAIL');
    });

    it('surfaces PSV freshness requirement when PSV summary provided', async () => {
      mockFindFirst.mockResolvedValue(null);

      const check: EnrollmentRequirementsCheck = {
        ...baseCheck,
        caqhProfile: MOCK_CAQH_PROFILE,
        psvResult: {
          overallStatus: 'WARNING',
          checkedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const result = await checkEnrollmentRequirements(check, mockPayer);
      const psvRequirement = result.results.find((r) => r.requirement === 'PSV Freshness');
      expect(psvRequirement).toBeDefined();
      expect(psvRequirement?.status).toBe('WARNING');
    });
  });

  describe('getRequirementsSummary', () => {
    it('should return success message when eligible', () => {
      const result = {
        overallStatus: 'PASS' as const,
        eligibleForEnrollment: true,
        results: [],
        criticalFailures: [],
        warnings: [],
        timestamp: new Date(),
      };

      const summary = getRequirementsSummary(result);
      expect(summary).toBe('Eligible for enrollment');
    });

    it('should return success with warnings message', () => {
      const result = {
        overallStatus: 'WARNING' as const,
        eligibleForEnrollment: true,
        results: [],
        criticalFailures: [],
        warnings: ['CAQH attestation older than 90 days'],
        timestamp: new Date(),
      };

      const summary = getRequirementsSummary(result);
      expect(summary).toContain('Eligible with 1 warning');
    });

    it('should return failure message with reasons', () => {
      const result = {
        overallStatus: 'FAIL' as const,
        eligibleForEnrollment: false,
        results: [],
        criticalFailures: ['CAQH profile required', 'NPDB adverse action found'],
        warnings: [],
        timestamp: new Date(),
      };

      const summary = getRequirementsSummary(result);
      expect(summary).toContain('Not eligible');
      expect(summary).toContain('CAQH profile required');
      expect(summary).toContain('NPDB adverse action found');
    });
  });
});
