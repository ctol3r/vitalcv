import { describe, expect, it } from '@jest/globals';
import {
  QualityMicroSignalSchema,
  createQualityMicroSignal,
  compareMicroSignalSeverity,
  maxMicroSignalSeverity,
  summarizeQualityMicroSignal,
  QUALITY_MICRO_SIGNAL_TYPES,
  QUALITY_MICRO_SIGNAL_SEVERITIES,
} from '../models/QualityMicroSignal.js';

describe('QualityMicroSignal model', () => {
  it('creates a signal with defaults applied', () => {
    const signal = createQualityMicroSignal({
      clinicianId: 'clinician-1',
      signalType: 'WEAK_OPPE_DRIFT',
      severity: 'LOW',
    });

    expect(signal.timestamp).toBeInstanceOf(Date);
    expect(signal.details).toEqual({});
    expect(signal.clinicianId).toBe('clinician-1');
    expect(signal.signalType).toBe('WEAK_OPPE_DRIFT');
    expect(signal.severity).toBe('LOW');
  });

  it('rejects invalid signal type', () => {
    expect(() =>
      QualityMicroSignalSchema.parse({
        clinicianId: 'clinician-1',
        signalType: 'INVALID_TYPE',
        severity: 'LOW',
        timestamp: new Date(),
      }),
    ).toThrow();
  });

  it('rejects invalid severity', () => {
    expect(() =>
      QualityMicroSignalSchema.parse({
        clinicianId: 'clinician-1',
        signalType: 'WEAK_OPPE_DRIFT',
        severity: 'HIGH', // Only LOW and MEDIUM are valid
        timestamp: new Date(),
      }),
    ).toThrow();
  });

  it('accepts all valid signal types', () => {
    for (const signalType of QUALITY_MICRO_SIGNAL_TYPES) {
      const signal = createQualityMicroSignal({
        clinicianId: 'clinician-1',
        signalType,
        severity: 'LOW',
      });
      expect(signal.signalType).toBe(signalType);
    }
  });

  it('accepts all valid severities', () => {
    for (const severity of QUALITY_MICRO_SIGNAL_SEVERITIES) {
      const signal = createQualityMicroSignal({
        clinicianId: 'clinician-1',
        signalType: 'WEAK_OPPE_DRIFT',
        severity,
      });
      expect(signal.severity).toBe(severity);
    }
  });

  it('compares severity ordering', () => {
    expect(compareMicroSignalSeverity('MEDIUM', 'LOW')).toBeGreaterThan(0);
    expect(compareMicroSignalSeverity('LOW', 'MEDIUM')).toBeLessThan(0);
    expect(compareMicroSignalSeverity('LOW', 'LOW')).toBe(0);
  });

  it('finds max severity', () => {
    expect(maxMicroSignalSeverity('LOW', 'MEDIUM')).toBe('MEDIUM');
    expect(maxMicroSignalSeverity('MEDIUM', 'LOW')).toBe('MEDIUM');
    expect(maxMicroSignalSeverity('LOW', 'LOW')).toBe('LOW');
    expect(maxMicroSignalSeverity()).toBeUndefined();
  });

  it('summarizes signal with custom summary', () => {
    const signal = createQualityMicroSignal({
      clinicianId: 'clinician-1',
      signalType: 'WEAK_OPPE_DRIFT',
      severity: 'LOW',
      details: {
        summary: 'Custom summary text',
      },
    });

    expect(summarizeQualityMicroSignal(signal)).toBe('Custom summary text');
  });

  it('summarizes signal without custom summary', () => {
    const signal = createQualityMicroSignal({
      clinicianId: 'clinician-1',
      signalType: 'MINOR_COMPLICATION_CLUSTER',
      severity: 'MEDIUM',
    });

    const summary = summarizeQualityMicroSignal(signal);
    expect(summary).toContain('MINOR_COMPLICATION_CLUSTER');
    expect(summary).toContain('MEDIUM');
  });

  it('accepts detailed signal information', () => {
    const signal = createQualityMicroSignal({
      clinicianId: 'clinician-1',
      signalType: 'PRIVILEGE_UNUSUAL_USAGE',
      severity: 'MEDIUM',
      details: {
        summary: 'Unusual privilege usage detected',
        metric: 'PRIVILEGE_USAGE_COUNT',
        observedValue: 15,
        expectedValue: 5,
        threshold: 10,
        sampleSize: 100,
        evidence: [
          { label: 'Usage Count', value: 15 },
          { label: 'Peer Mean', value: 5 },
        ],
        metadata: {
          privilegeCode: 'PRIV-001',
        },
      },
      source: 'PrivilegeUsageAnomalyExtractor',
    });

    expect(signal.details.summary).toBe('Unusual privilege usage detected');
    expect(signal.details.observedValue).toBe(15);
    expect(signal.details.evidence).toHaveLength(2);
    expect(signal.source).toBe('PrivilegeUsageAnomalyExtractor');
  });
});

