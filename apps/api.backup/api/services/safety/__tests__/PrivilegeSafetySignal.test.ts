import { describe, expect, it } from '@jest/globals';
import {
  createPrivilegeSafetySignal,
  compareSafetySeverity,
  maxSafetySeverity,
} from '../models/PrivilegeSafetySignal.js';

describe('PrivilegeSafetySignal model', () => {
  it('creates a valid safety signal with defaults', () => {
    const signal = createPrivilegeSafetySignal({
      clinicianId: 'clinician-1',
      orgId: 'org-1',
      privilegeCodes: ['ANES-BASE'],
      signalType: 'DEA_EXPIRED',
      severity: 'HIGH',
      summary: 'DEA expired for anesthesia set',
      source: 'unit-test',
    });

    expect(signal.privilegeCodes).toEqual(['ANES-BASE']);
    expect(signal.detectedAt).toBeInstanceOf(Date);
    expect(signal.severity).toBe('HIGH');
  });

  it('rejects empty privilege sets', () => {
    expect(() =>
      createPrivilegeSafetySignal({
        clinicianId: 'clinician-1',
        privilegeCodes: [],
        signalType: 'LICENSE_RISK',
        severity: 'LOW',
        summary: 'noop',
        source: 'unit-test',
      })
    ).toThrow(/privilegeCodes/);
  });

  it('compares severities correctly', () => {
    expect(compareSafetySeverity('HIGH', 'MED')).toBeGreaterThan(0);
    expect(maxSafetySeverity('LOW', 'MED', 'CRITICAL')).toBe('CRITICAL');
  });
});

