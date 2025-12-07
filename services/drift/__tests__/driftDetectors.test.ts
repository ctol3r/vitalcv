import { licenseDriftDetector } from '../detectors/licenseDrift';
import { boardDriftDetector } from '../detectors/boardDrift';
import { deaDriftDetector } from '../detectors/deaDrift';
import { directoryDriftDetector } from '../detectors/directoryDrift';
import { pecosDriftDetector } from '../detectors/pecosDrift';
import { medicaidDriftDetector } from '../detectors/medicaidDrift';
import { PecosLifecycleStatus } from '../../pecos/models/PECOSEnrollment';

describe('LicenseDriftDetector', () => {
  it('flags critical status drift and expired licenses', () => {
    const result = licenseDriftDetector.detect({
      clinicianId: 'clin-1',
      baseline: {
        state: 'CA',
        licenseNumber: 'A123',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      observed: {
        state: 'CA',
        licenseNumber: 'A123',
        status: 'SUSPENDED',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        practiceLocations: [{ line1: '123 Main', city: 'SF', state: 'CA' }],
      },
    });

    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.events[0].severity).toBe('critical');
    expect(result.stats?.totalSignals).toBe(result.events.length);
  });
});

describe('BoardDriftDetector', () => {
  it('emits timeline events and risk impacts for expired certifications', () => {
    const result = boardDriftDetector.detect({
      clinicianId: 'clin-2',
      observed: {
        board: 'ABIM',
        specialty: 'Internal Medicine',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    expect(result.events[0].title).toContain('Board certification expired');
    expect(result.timelineEvents?.length).toBeGreaterThan(0);
    expect(result.riskImpacts?.length).toBeGreaterThan(0);
  });
});

describe('DEADriftDetector', () => {
  it('triggers high severity when schedules change', () => {
    const result = deaDriftDetector.detect({
      clinicianId: 'clin-3',
      baseline: {
        registrationNumber: 'DEA123',
        schedules: ['II', 'III'],
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
      observed: {
        registrationNumber: 'DEA123',
        schedules: ['III'],
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      requiredSchedules: ['II'],
    });

    expect(result.events.some((event) => event.title.includes('DEA schedule drift'))).toBe(true);
  });
});

describe('DirectoryDriftDetector', () => {
  it('detects taxonomy mismatches', () => {
    const result = directoryDriftDetector.detect({
      clinicianId: 'clin-4',
      baseline: {
        npi: '1111111111',
        source: 'NPPES',
        taxonomyCode: '207R00000X',
        name: { first: 'Alex', last: 'Smith' },
        practiceAddress: { line1: '1 Main', city: 'Austin', state: 'TX' },
      },
      observed: {
        npi: '1111111111',
        source: 'NPPES',
        taxonomyCode: '207P00000X',
        name: { first: 'Alex', last: 'Smith' },
        practiceAddress: { line1: '1 Main', city: 'Austin', state: 'TX' },
      },
      acceptedTaxonomyCodes: ['207R00000X'],
    });

    expect(result.events[0].title).toContain('taxonomy drift');
    expect(result.events[0].severity).toBe('critical');
  });
});

describe('PecosDriftDetector', () => {
  it('warns about revalidation deadlines', () => {
    const result = pecosDriftDetector.detect({
      clinicianId: 'clin-5',
      observed: {
        enrollmentId: 'pecos-1',
        status: PecosLifecycleStatus.ENROLLED,
        revalidationDueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      expectedStatus: PecosLifecycleStatus.ENROLLED,
    });

    expect(result.events.some((event) => event.summary.includes('revalidation'))).toBe(true);
  });
});

describe('MedicaidDriftDetector', () => {
  it('flags dis-enrollment and attaches payer insights', () => {
    const result = medicaidDriftDetector.detect({
      clinicianId: 'clin-6',
      baseline: {
        program: 'Medicaid TX',
        enrollmentId: 'med-1',
        state: 'TX',
        status: 'ACTIVE',
      },
      observed: {
        program: 'Medicaid TX',
        enrollmentId: 'med-1',
        state: 'TX',
        status: 'TERMINATED',
      },
      payerInsights: [
        {
          code: 'PANEL_CLOSED',
          severity: 'warning',
          message: 'Panel closed',
        },
      ],
    });

    expect(result.events[0].title).toContain('dis-enrollment');
    expect(result.events[0].metadata).toHaveProperty('payerInsights');
  });
});
