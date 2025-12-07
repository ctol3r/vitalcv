import { describe, expect, it } from '@jest/globals';
import {
  ALL_PRIVILEGES_TOKEN,
  compareSafetySeverity,
  createPrivilegeSafetySignal,
  ensurePrivilegeCodes,
} from '../models/PrivilegeSafetySignal.js';

describe('PrivilegeSafetySignal model', () => {
  it('enforces required fields and normalizes privilege codes', () => {
    const signal = createPrivilegeSafetySignal({
      clinicianId: 'clin-1',
      signalType: 'LICENSE_RISK',
      severity: 'HIGH',
      privilegeCodes: ['card-cath-lab', 'CARD-CATH-LAB', ' '],
      summary: 'License expired in CA',
      source: 'test-suite',
    });

    expect(signal.privilegeCodes).toEqual(['CARD-CATH-LAB']);
    expect(signal.triggeredAt).toBeInstanceOf(Date);
  });

  it('falls back to global indicator when privilege codes missing', () => {
    const codes = ensurePrivilegeCodes([]);
    expect(codes).toEqual([ALL_PRIVILEGES_TOKEN]);
  });

  it('compares severity ordering correctly', () => {
    expect(compareSafetySeverity('HIGH', 'MED')).toBeGreaterThan(0);
    expect(compareSafetySeverity('LOW', 'CRITICAL')).toBeLessThan(0);
  });
});

