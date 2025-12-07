import {
  QualitySignalSchema,
  createQualitySignal,
  compareSignalSeverity,
} from '../models/QualitySignal';
import { analyzeOppeTrends } from '../analyzers/oppeTrend';
import { analyzeFppePerformance } from '../analyzers/fppeAnalysis';
import { analyzeComplicationVariance } from '../analyzers/complicationVariance';
import { analyzeEhrPrivilegeMismatch } from '../analyzers/ehrMismatch';

describe('QualitySignal model', () => {
  it('creates a signal with defaults applied', () => {
    const signal = createQualitySignal({
      clinicianId: 'clinician-1',
      signalType: 'LOW_VOLUME',
      severity: 'MED',
    });

    expect(signal.timestamp).toBeInstanceOf(Date);
    expect(signal.details).toEqual({});
  });

  it('rejects invalid severity', () => {
    expect(() =>
      QualitySignalSchema.parse({
        clinicianId: 'clinician-1',
        signalType: 'LOW_VOLUME',
        severity: 'INVALID',
        timestamp: new Date(),
      }),
    ).toThrow();
  });

  it('compares severity ordering', () => {
    expect(compareSignalSeverity('HIGH', 'MED')).toBeGreaterThan(0);
    expect(compareSignalSeverity('LOW', 'CRITICAL')).toBeLessThan(0);
  });
});

describe('analyzeOppeTrends', () => {
  const baseCases = [
    {
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      caseCount: 40,
      complications: 1,
    },
    {
      periodStart: new Date('2025-02-01'),
      periodEnd: new Date('2025-02-28'),
      caseCount: 35,
      complications: 2,
    },
    {
      periodStart: new Date('2025-03-01'),
      periodEnd: new Date('2025-03-31'),
      caseCount: 28,
      complications: 3,
    },
    {
      periodStart: new Date('2025-04-01'),
      periodEnd: new Date('2025-04-30'),
      caseCount: 18,
      complications: 4,
    },
  ];

  it('detects negative quality slope and volume dips', () => {
    const signals = analyzeOppeTrends({
      clinicianId: 'clinician-1',
      specialty: 'CARDIOLOGY',
      cases: baseCases,
    });

    const types = signals.map((signal) => signal.signalType);
    expect(types).toContain('OPPE_LOW');
    expect(types).toContain('LOW_VOLUME');
  });

  it('detects excessive variability when toggling metrics', () => {
    const alternating = baseCases.map((sample, index) => ({
      ...sample,
      caseCount: index % 2 === 0 ? 50 : 10,
      complications: index % 2 === 0 ? 0 : 5,
    }));

    const signals = analyzeOppeTrends({
      clinicianId: 'clinician-2',
      cases: alternating,
    });

    expect(signals.some((signal) => signal.signalType === 'EXCESSIVE_VARIANCE')).toBe(true);
  });
});

describe('analyzeFppePerformance', () => {
  it('emits CRITICAL signal when FPPE fails', () => {
    const signals = analyzeFppePerformance({
      clinicianId: 'clinician-1',
      cases: [
        { caseId: 'case-1', status: 'FAILED', failureReason: 'Complication spike' },
        { caseId: 'case-2', status: 'COMPLETED', completionScore: 0.5 },
      ],
    });

    const critical = signals.find((signal) => signal.severity === 'CRITICAL');
    expect(critical?.signalType).toBe('FPPE_FAILURE');

    const weak = signals.find(
      (signal) => signal.severity === 'HIGH' && signal.signalType === 'FPPE_FAILURE',
    );
    expect(weak).toBeDefined();
  });

  it('detects missing evidence as MED severity', () => {
    const signals = analyzeFppePerformance({
      clinicianId: 'clinician-2',
      cases: [
        {
          caseId: 'case-9',
          status: 'IN_REVIEW',
          evidenceRequired: 3,
          evidenceProvided: 1,
          missingEvidence: ['peer_reference'],
        },
      ],
    });

    expect(signals[0].severity).toBe('MED');
  });
});

describe('analyzeComplicationVariance', () => {
  const events = Array.from({ length: 20 }).map((_, index) => ({
    occurredAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
    complication: index < 6,
    durationMinutes: index % 2 === 0 ? 30 : 120,
  }));

  it('flags complication spikes and variance', () => {
    const result = analyzeComplicationVariance({
      clinicianId: 'clinician-1',
      specialty: 'ORTHO',
      events,
      baseline: {
        avgComplicationRate: 0.05,
        stdComplicationRate: 0.02,
        avgDurationMinutes: 60,
        stdDurationMinutes: 10,
      },
    });

    const types = result.signals.map((signal) => signal.signalType);
    expect(types).toContain('COMPLICATION_SPIKE');
    expect(result.stats.sampleSize).toBeGreaterThanOrEqual(10);
  });
});

describe('analyzeEhrPrivilegeMismatch', () => {
  it('returns critical quality signal and drift event', () => {
    const result = analyzeEhrPrivilegeMismatch({
      clinicianId: 'clinician-1',
      orgId: 'org-1',
      ehrPrivileges: [
        { code: 'PRIV-A', status: 'ACTIVE' },
        { code: 'PRIV-B', status: 'ACTIVE' },
      ],
      vitalPrivileges: [{ code: 'PRIV-A', status: 'SUSPENDED' }],
    });

    expect(result.signals[0].signalType).toBe('EHR_PRIVILEGE_MISMATCH');
    expect(result.signals[0].severity).toBe('CRITICAL');
    expect(result.driftEvents).toHaveLength(1);
    expect(result.mismatches.missingInVital).toContain('PRIV-B');
    expect(result.mismatches.downgraded).toContain('PRIV-A');
  });
});

