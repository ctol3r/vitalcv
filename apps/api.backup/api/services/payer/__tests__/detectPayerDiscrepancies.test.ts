import { describe, expect, it } from '@jest/globals';
import { detectPayerDiscrepancies, type DiscrepancyContext } from '../detectPayerDiscrepancies.js';

const baseContext: DiscrepancyContext = {
  clinicianId: 'clinician-1',
  clinicianSpecialty: 'Family Medicine',
  payer: {
    id: 'payer-1',
    name: 'Acme Health',
    requiresCaqh: true,
    specialty: ['Family Medicine'],
  },
  caqh: {
    hasProfile: true,
    missingSections: [],
    malpractice: {
      carrier: 'Malpractice Co',
      expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  enrollment: {
    id: 'enroll-1',
    clinicianId: 'clinician-1',
    payerId: 'payer-1',
    status: 'ATTEMPTING',
    panelType: 'OPEN',
    effectiveDate: null,
    notes: null,
    metadata: null,
    lastStatusChange: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('detectPayerDiscrepancies', () => {
  it('flags missing CAQH data', () => {
    const findings = detectPayerDiscrepancies({
      ...baseContext,
      caqh: undefined,
    });

    expect(findings.some((f) => f.code === 'MISSING_CAQH_DATA')).toBe(true);
  });

  it('flags specialty mismatch', () => {
    const findings = detectPayerDiscrepancies({
      ...baseContext,
      clinicianSpecialty: 'Dermatology',
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SPECIALTY_MISMATCH', severity: 'critical' }),
      ])
    );
  });

  it('flags expired malpractice', () => {
    const findings = detectPayerDiscrepancies({
      ...baseContext,
      caqh: {
        hasProfile: true,
        malpractice: {
          carrier: 'Expired Carrier',
          expirationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MALPRACTICE_OUTDATED', severity: 'critical' }),
      ])
    );
  });

  it('flags panel closed status', () => {
    const findings = detectPayerDiscrepancies({
      ...baseContext,
      enrollment: {
        ...baseContext.enrollment!,
        status: 'PANEL_FULL',
        panelType: 'CLOSED',
      },
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PANEL_CLOSED', severity: 'warning' }),
      ])
    );
  });
});

