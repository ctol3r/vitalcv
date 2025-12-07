import { describe, expect, it } from '@jest/globals';
import { reduceAnalyticsEvents } from '../oppeAutoPopulate';

describe('oppeAutoPopulate reduceAnalyticsEvents', () => {
  it('accumulates matching analytics events into metrics', () => {
    const now = new Date();
    const metrics = reduceAnalyticsEvents([
      { eventType: 'jobs.match.completed', timestamp: now },
      { eventType: 'psv.license.issue', timestamp: now },
      { eventType: 'compliance.issue.flagged', timestamp: now },
      { eventType: 'unknown.event', timestamp: now },
    ] as any);

    expect(metrics.caseCount).toBe(1);
    expect(metrics.licenseIssues).toBe(1);
    expect(metrics.issuesFlagged).toBe(1);
  });

  it('adds onto base metrics', () => {
    const base = {
      caseCount: 5,
      complications: 0,
      issuesFlagged: 0,
      licenseIssues: 0,
      boardAlerts: 0,
      deaFindings: 0,
      lastEventAt: undefined,
    };

    const metrics = reduceAnalyticsEvents(
      [{ eventType: 'clinical.complication.reported', timestamp: new Date() }] as any,
      base
    );

    expect(metrics.complications).toBe(1);
    expect(metrics.caseCount).toBe(5);
  });
});
