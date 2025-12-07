import {
  NCQAComplianceRecordSchema,
  deriveComplianceUrgency,
  normalizeNCQAComplianceRecord,
  shouldAlertOnCompliance,
} from '../models/NCQAComplianceRecord';

describe('NCQAComplianceRecord schema', () => {
  it('normalizes ISO date strings into Date instances', () => {
    const payload = {
      clinicianId: 'clin-123',
      ruleCode: 'CR1',
      status: 'PASS',
      lastVerifiedAt: '2025-01-01T00:00:00Z',
      nextDueAt: '2025-03-01T00:00:00Z',
      evidenceRefs: [
        {
          id: 'ev-1',
          type: 'PSV_RESULT',
          label: 'PSV bundle',
          uri: '/psv/results/ev-1',
          capturedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const normalized = normalizeNCQAComplianceRecord(payload);
    expect(normalized.lastVerifiedAt).toBeInstanceOf(Date);
    expect(normalized.nextDueAt).toBeInstanceOf(Date);
    expect(normalized.evidenceRefs[0].capturedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid statuses or rule codes', () => {
    expect(() =>
      NCQAComplianceRecordSchema.parse({
        clinicianId: 'clin-123',
        ruleCode: 'CR9',
        status: 'PASS',
      })
    ).toThrow('Invalid enum value');
  });
});

describe('deriveComplianceUrgency', () => {
  it.each([
    ['OVERDUE', '2025-01-01', '2024-12-01'],
    ['DUE_SOON', '2025-01-01', '2025-01-20'],
    ['ON_TRACK', '2025-01-01', '2025-02-15'],
  ])('%s classification', (expected, asOf, dueDate) => {
    const record = normalizeNCQAComplianceRecord({
      clinicianId: 'clin-123',
      ruleCode: 'CR2',
      status: 'PASS',
      nextDueAt: dueDate,
    });
    expect(deriveComplianceUrgency(record, new Date(asOf))).toBe(expected);
  });
});

describe('shouldAlertOnCompliance', () => {
  it('alerts on FAIL or WARN statuses', () => {
    const failRecord = normalizeNCQAComplianceRecord({
      clinicianId: 'clin-123',
      ruleCode: 'CR4',
      status: 'FAIL',
    });
    const warnRecord = normalizeNCQAComplianceRecord({
      clinicianId: 'clin-123',
      ruleCode: 'CR5',
      status: 'WARN',
    });
    const passRecord = normalizeNCQAComplianceRecord({
      clinicianId: 'clin-123',
      ruleCode: 'CR1',
      status: 'PASS',
    });

    expect(shouldAlertOnCompliance(failRecord)).toBe(true);
    expect(shouldAlertOnCompliance(warnRecord)).toBe(true);
    expect(shouldAlertOnCompliance(passRecord)).toBe(false);
  });
});

