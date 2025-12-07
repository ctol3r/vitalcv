import {
  CreateOPPEScheduleV2Schema,
  UpdateOPPEScheduleV2Schema,
  calculateNextDueAt,
  getEvaluationWindow,
  isScheduleDue,
  mergeMetricsConfig,
  normalizeMetricsConfig,
} from '../OPPEScheduleV2';

describe('OPPEScheduleV2 model', () => {
  it('validates create input with defaults', () => {
    const result = CreateOPPEScheduleV2Schema.parse({
      clinicianId: 'did:example:123',
      orgId: 'org-1',
    });

    expect(result.frequencyMonths).toBe(12);
    expect(result.metricsConfig).toEqual({});
  });

  it('rejects invalid frequencies', () => {
    expect(() =>
      CreateOPPEScheduleV2Schema.parse({
        clinicianId: 'id',
        orgId: 'org',
        frequencyMonths: 0,
      })
    ).toThrow();

    expect(() =>
      UpdateOPPEScheduleV2Schema.parse({
        frequencyMonths: 48,
      })
    ).toThrow();
  });

  it('calculates next due date in months', () => {
    const base = new Date('2025-01-15T00:00:00Z');
    const next = calculateNextDueAt(base, 6);
    expect(next.toISOString()).toBe(new Date('2025-07-15T00:00:00Z').toISOString());
  });

  it('returns correct evaluation window', () => {
    const due = new Date('2025-10-01T00:00:00Z');
    const { periodStart, periodEnd } = getEvaluationWindow(due, 3);
    expect(periodEnd.toISOString()).toBe(due.toISOString());
    expect(periodStart.toISOString()).toBe(new Date('2025-07-01T00:00:00Z').toISOString());
  });

  it('detects overdue schedules', () => {
    const schedule = { nextDueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) };
    expect(isScheduleDue(schedule)).toBe(true);
    expect(isScheduleDue({ nextDueAt: new Date(Date.now() + 1000 * 60 * 60) })).toBe(false);
  });

  it('normalizes and merges metric configs', () => {
    expect(normalizeMetricsConfig({ cases: 5, complications: '2' })).toEqual({ cases: 5, complications: 2 });
    expect(normalizeMetricsConfig({ cases: -1 })).toEqual({});

    const merged = mergeMetricsConfig({ cases: 5 }, { complications: 0, cases: 7 });
    expect(merged).toEqual({ cases: 7, complications: 0 });
  });
});
