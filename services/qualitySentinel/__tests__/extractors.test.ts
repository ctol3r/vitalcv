import { describe, expect, it } from '@jest/globals';
import { OPPEMicroDriftExtractor } from '../extractors/oppeMicroDrift.js';
import { ComplicationClusterDetector } from '../extractors/complicationCluster.js';
import { EnrollmentMicroTrendAnalyzer } from '../extractors/enrollmentTrend.js';
import { PrivilegeUsageAnomalyExtractor } from '../extractors/privilegeUsage.js';

describe('OPPEMicroDriftExtractor', () => {
  it('detects downward trend in OPPE scores', () => {
    const extractor = new OPPEMicroDriftExtractor({
      windowSize: 4,
      minWindowSize: 3,
      trendThreshold: -0.05,
    });

    const cases = [
      {
        id: '1',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-01-01'),
        score: 0.9,
        caseCount: 20,
      },
      {
        id: '2',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-02-01'),
        score: 0.85,
        caseCount: 20,
      },
      {
        id: '3',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-03-01'),
        score: 0.8,
        caseCount: 20,
      },
      {
        id: '4',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-04-01'),
        score: 0.75,
        caseCount: 20,
      },
    ];

    const signals = extractor.extract('clinician-1', cases);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe('WEAK_OPPE_DRIFT');
    expect(signals[0].severity).toBe('LOW');
  });

  it('returns empty array when insufficient data', () => {
    const extractor = new OPPEMicroDriftExtractor();
    const cases = [
      {
        id: '1',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-01-01'),
        score: 0.9,
      },
    ];

    const signals = extractor.extract('clinician-1', cases);
    expect(signals).toHaveLength(0);
  });

  it('detects excessive variance', () => {
    const extractor = new OPPEMicroDriftExtractor({
      windowSize: 4,
      minWindowSize: 3,
      varianceThreshold: 0.15,
    });

    const cases = [
      {
        id: '1',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-01-01'),
        score: 0.5,
        caseCount: 20,
      },
      {
        id: '2',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-02-01'),
        score: 0.9,
        caseCount: 20,
      },
      {
        id: '3',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-03-01'),
        score: 0.4,
        caseCount: 20,
      },
      {
        id: '4',
        clinicianId: 'clinician-1',
        reviewDate: new Date('2025-04-01'),
        score: 0.95,
        caseCount: 20,
      },
    ];

    const signals = extractor.extract('clinician-1', cases);
    const varianceSignals = signals.filter((s) => s.details?.metric === 'OPPE_SCORE_VARIANCE');
    expect(varianceSignals.length).toBeGreaterThan(0);
  });
});

describe('ComplicationClusterDetector', () => {
  it('detects subtle complication clusters', () => {
    const detector = new ComplicationClusterDetector({
      windowSize: 20,
      minWindowSize: 10,
      clusterThreshold: 0.1,
      baselineRate: 0.02,
      minCasesForCluster: 2,
    });

    const cases = Array.from({ length: 20 }, (_, i) => ({
      id: `case-${i}`,
      clinicianId: 'clinician-1',
      caseDate: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
      hasComplication: i < 2, // 2 complications in 20 cases = 10%
    }));

    const signals = detector.extract('clinician-1', cases);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe('MINOR_COMPLICATION_CLUSTER');
  });

  it('returns empty when no cluster detected', () => {
    const detector = new ComplicationClusterDetector();
    const cases = Array.from({ length: 20 }, (_, i) => ({
      id: `case-${i}`,
      clinicianId: 'clinician-1',
      caseDate: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
      hasComplication: false,
    }));

    const signals = detector.extract('clinician-1', cases);
    expect(signals).toHaveLength(0);
  });

  it('handles cases with complication types', () => {
    const detector = new ComplicationClusterDetector();
    const cases = Array.from({ length: 20 }, (_, i) => ({
      id: `case-${i}`,
      clinicianId: 'clinician-1',
      caseDate: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
      hasComplication: i < 2,
      complicationType: i === 0 ? 'INFECTION' : 'BLEEDING',
    }));

    const signals = detector.extract('clinician-1', cases);
    if (signals.length > 0) {
      expect(signals[0].details?.metadata?.complicationTypes).toBeDefined();
    }
  });
});

describe('EnrollmentMicroTrendAnalyzer', () => {
  it('detects rising payer denial trends', () => {
    const analyzer = new EnrollmentMicroTrendAnalyzer({
      denialWindowDays: 90,
      minDenialsForTrend: 3,
      denialIncreaseThreshold: 0.5,
    });

    const denials = [
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-01-01') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-01-15') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-02-01') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-02-15') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-03-01') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-03-15') },
      { payerId: 'payer-1', payerName: 'Payer A', denialDate: new Date('2025-04-01') },
    ];

    const signals = analyzer.analyzePayerDenials('clinician-1', denials);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe('ENROLLMENT_DENIAL_MICROTREND');
  });

  it('detects stalled PECOS changes', () => {
    const analyzer = new EnrollmentMicroTrendAnalyzer({
      pecosStallDays: 30,
    });

    const now = new Date();
    const changes = [
      {
        changeDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        changeType: 'UPDATE' as const,
        status: 'PENDING' as const,
      },
    ];

    const signals = analyzer.analyzePECOSStalls('clinician-1', changes);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('detects unusual Medicaid shifts', () => {
    const analyzer = new EnrollmentMicroTrendAnalyzer({
      medicaidShiftThreshold: 2,
    });

    const enrollments = [
      {
        state: 'CA',
        enrollmentDate: new Date('2025-01-01'),
        status: 'ENROLLED' as const,
        changeDate: new Date('2025-01-01'),
      },
      {
        state: 'NY',
        enrollmentDate: new Date('2025-02-01'),
        status: 'ENROLLED' as const,
        changeDate: new Date('2025-02-01'),
      },
      {
        state: 'TX',
        enrollmentDate: new Date('2025-03-01'),
        status: 'ENROLLED' as const,
        changeDate: new Date('2025-03-01'),
      },
    ];

    const signals = analyzer.analyzeMedicaidShifts('clinician-1', enrollments);
    expect(signals.length).toBeGreaterThan(0);
  });
});

describe('PrivilegeUsageAnomalyExtractor', () => {
  it('detects high privilege usage anomalies', () => {
    const extractor = new PrivilegeUsageAnomalyExtractor({
      zScoreThreshold: 2.0,
      minBaselineSampleSize: 10,
    });

    const usage = [
      {
        privilegeCode: 'PRIV-001',
        privilegeName: 'Procedure A',
        usageCount: 20,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      },
    ];

    const baselines = [
      {
        specialty: 'CARDIOLOGY',
        privilegeCode: 'PRIV-001',
        meanUsage: 5,
        stdDevUsage: 3,
        percentile25: 3,
        percentile75: 7,
        sampleSize: 50,
      },
    ];

    const signals = extractor.extract('clinician-1', 'CARDIOLOGY', usage, baselines);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe('PRIVILEGE_UNUSUAL_USAGE');
  });

  it('returns empty when usage is within normal range', () => {
    const extractor = new PrivilegeUsageAnomalyExtractor();
    const usage = [
      {
        privilegeCode: 'PRIV-001',
        privilegeName: 'Procedure A',
        usageCount: 5,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      },
    ];

    const baselines = [
      {
        specialty: 'CARDIOLOGY',
        privilegeCode: 'PRIV-001',
        meanUsage: 5,
        stdDevUsage: 3,
        percentile25: 3,
        percentile75: 7,
        sampleSize: 50,
      },
    ];

    const signals = extractor.extract('clinician-1', 'CARDIOLOGY', usage, baselines);
    expect(signals).toHaveLength(0);
  });

  it('handles missing baselines gracefully', () => {
    const extractor = new PrivilegeUsageAnomalyExtractor();
    const usage = [
      {
        privilegeCode: 'PRIV-001',
        privilegeName: 'Procedure A',
        usageCount: 20,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      },
    ];

    const baselines: typeof usage extends Array<infer T> ? T[] : never[] = [];

    const signals = extractor.extract('clinician-1', 'CARDIOLOGY', usage, baselines);
    expect(signals).toHaveLength(0);
  });
});

