import {
  CreateOPPECaseSchema,
  OPPECaseStatusSchema,
  initializeMetricsFromTargets,
  mergeMetrics,
  normalizeMetrics,
} from '../OPPECase';

describe('OPPECase model', () => {
  it('validates create payload', () => {
    const result = CreateOPPECaseSchema.parse({
      scheduleId: 'sched-1',
      clinicianId: 'did:example:123',
      orgId: 'org-1',
      privilegeCode: 'CPT-001',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-03-31'),
    });

    expect(result.status).toBe('OPEN');
    expect(OPPECaseStatusSchema.safeParse(result.status).success).toBe(true);
  });

  it('normalizes metrics defaults', () => {
    expect(normalizeMetrics({ caseCount: 5, complications: 1, lastEventAt: '2025-01-01T00:00:00.000Z' })).toEqual({
      caseCount: 5,
      complications: 1,
      issuesFlagged: 0,
      licenseIssues: 0,
      boardAlerts: 0,
      deaFindings: 0,
      lastEventAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('initializes metrics from schedule targets', () => {
    const metrics = initializeMetricsFromTargets({ cases: 12, complications: 0 });
    expect(metrics.caseCount).toBe(12);
    expect(metrics.complications).toBe(0);
  });

  it('merges metric deltas while keeping non-negative values', () => {
    const base = initializeMetricsFromTargets({ cases: 10 });
    const merged = mergeMetrics(base, { issuesFlagged: 2, licenseIssues: 1, lastEventAt: '2025-02-01T00:00:00.000Z' });
    expect(merged.issuesFlagged).toBe(2);
    expect(merged.licenseIssues).toBe(1);
    expect(merged.lastEventAt).toBe('2025-02-01T00:00:00.000Z');
  });
});
