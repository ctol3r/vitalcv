import { describe, expect, it } from '@jest/globals';
import { evaluatePayerEligibility, type PayerEligibilityInput } from '../eligibilityEngine.js';

const baseInput: PayerEligibilityInput = {
  clinicianId: 'clinician-1',
  payerId: 'payer-1',
  specialty: 'Internal Medicine',
  caqh: {
    completeness: 0.97,
    attestedAt: new Date().toISOString(),
  },
  boardCertification: {
    specialty: 'Internal Medicine',
    status: 'ACTIVE',
    expiresOn: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  dea: {
    registrationNumber: 'DEA12345',
    schedules: ['II', 'III', 'IV'],
    expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  pecos: {
    status: 'APPROVED',
  },
  medicaid: {
    status: 'ACTIVE',
    state: 'CA',
    requiresPecosAlignment: true,
  },
};

describe('eligibilityEngine', () => {
  it('passes when all rules satisfied', () => {
    const result = evaluatePayerEligibility(baseInput);

    expect(result.overallStatus).toBe('PASS');
    expect(result.blockers).toHaveLength(0);
  });

  it('fails when CAQH completeness below threshold', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      caqh: {
        completeness: 0.65,
        missingSections: ['practice_locations', 'malpractice'],
      },
    });

    expect(result.overallStatus).toBe('FAIL');
    expect(result.blockers[0]).toContain('completeness');
  });

  it('warns when CAQH attestation is stale', () => {
    const staleResult = evaluatePayerEligibility({
      ...baseInput,
      caqh: {
        completeness: 0.95,
        attestedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    expect(staleResult.overallStatus).toBe('WARNING');
    expect(staleResult.warnings[0]).toContain('attestation');
  });

  it('fails when board certification specialty mismatches', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      boardCertification: {
        specialty: 'Pediatrics',
        status: 'ACTIVE',
        expiresOn: baseInput.boardCertification?.expiresOn,
      },
    });

    expect(result.overallStatus).toBe('FAIL');
    expect(result.blockers[0]).toContain('mismatch');
  });

  it('fails when DEA schedule requirements not met', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      dea: {
        registrationNumber: 'DEA000',
        schedules: ['II'],
        expiresOn: baseInput.dea!.expiresOn,
      },
    });

    expect(result.overallStatus).toBe('FAIL');
    expect(result.blockers[0]).toContain('DEA');
  });

  it('fails when Medicaid active without PECOS approval', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      pecos: undefined,
      medicaid: {
        status: 'ACTIVE',
        state: 'TX',
        requiresPecosAlignment: true,
      },
    });

    expect(result.overallStatus).toBe('FAIL');
    expect(result.blockers[0]).toContain('PECOS approval missing');
  });

  it('warns when Medicaid suspended', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      medicaid: {
        status: 'SUSPENDED',
        state: 'WA',
      },
    });

    expect(result.overallStatus).toBe('WARNING');
    expect(result.warnings[0]).toContain('Medicaid suspended');
  });

  it('warns when PECOS revalidation due while Medicaid active', () => {
    const result = evaluatePayerEligibility({
      ...baseInput,
      pecos: {
        status: 'REVALIDATION_DUE',
        revalidationDueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    expect(result.overallStatus).toBe('WARNING');
    expect(result.warnings[0]).toContain('revalidation');
  });
});

