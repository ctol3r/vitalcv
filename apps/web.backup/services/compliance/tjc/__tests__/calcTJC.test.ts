import { evaluateTjcRules } from '../ruleRegistry.js';
import { summarizeStandardsFromRules, type TJCSignalSnapshot } from '../../models/TJCComplianceRecord.js';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

const now = new Date();
const isoNow = now.toISOString();
const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

const baseSignals: TJCSignalSnapshot = {
  generatedAt: isoNow,
  clinicianId: 'clinician-1',
  orgId: 'org-1',
  fppe: {
    completedCount: 2,
    openCount: 0,
    overdueCount: 0,
    lastCompletedAt: isoNow,
  },
  oppe: {
    overdueCases: 0,
    failedCases: 0,
    activeCases: 1,
    lastReviewAt: isoNow,
    metrics: {
      complications: 0,
      issuesFlagged: 0,
      licenseIssues: 0,
      boardAlerts: 0,
      deaFindings: 0,
    },
  },
  privileges: {
    active: 2,
    expiringSoon: 0,
    expired: 0,
    suspended: 0,
    temporary: 0,
  },
  licenses: {
    total: 2,
    active: 2,
    expired: 0,
    expiringSoon: 0,
    restricted: 0,
    disciplinaryFlags: 0,
  },
  psv: {
    checkedAt: isoNow,
    freshUntil: ninetyDaysOut,
    isFresh: true,
    daysRemaining: 90,
    overallStatus: 'PASS',
  },
  npdb: {
    lastCheckedAt: isoNow,
    status: 'CLEAN',
    adverseActionCount: 0,
  },
  sanctions: {
    lastCheckedAt: isoNow,
    status: 'CLEAR',
    adverseActionCount: 0,
  },
  competency: {
    outstandingActions: 0,
    oppeStatus: 'ACTIVE',
    fppeStatus: 'COMPLETED',
  },
  enrollment: {
    total: 2,
    active: 2,
    revalidationDue: 0,
  },
};

function buildSnapshot(overrides?: DeepPartial<TJCSignalSnapshot>): TJCSignalSnapshot {
  const clone = JSON.parse(JSON.stringify(baseSignals));
  if (!overrides) {
    return clone;
  }
  applyOverrides(clone, overrides);
  return clone;
}

function applyOverrides(target: Record<string, any>, source?: Record<string, any>) {
  if (!source) {
    return;
  }
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = target[key] ?? {};
      applyOverrides(target[key], value as Record<string, any>);
      continue;
    }
    target[key] = value;
  }
}

function getStandardStatus(ruleResults: ReturnType<typeof evaluateTjcRules>, standard: string) {
  const { standardResults } = summarizeStandardsFromRules(ruleResults);
  return standardResults[standard as keyof typeof standardResults].status;
}

describe('TJC rule evaluation', () => {
  it('returns PASS for healthy signals', () => {
    const rules = evaluateTjcRules(buildSnapshot());
    const summary = summarizeStandardsFromRules(rules);
    expect(summary.overallStatus).toBe('PASS');
  });

  it('warns when FPPE completion data is missing', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        fppe: {
          completedCount: 0,
          openCount: 1,
          overdueCount: 0,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS01')).toBe('WARN');
  });

  it('fails MS01 when FPPE cases are overdue', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        fppe: {
          overdueCount: 2,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS01')).toBe('FAIL');
  });

  it('warns MS03 when OPPE metrics show issues', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        oppe: {
          metrics: {
            complications: 1,
            issuesFlagged: 1,
          },
        },
      })
    );
    expect(getStandardStatus(rules, 'MS03')).toBe('WARN');
  });

  it('fails MS03 when OPPE cases are overdue', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        oppe: {
          overdueCases: 2,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS03')).toBe('FAIL');
  });

  it('fails MS05 when a license is expired', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        licenses: {
          expired: 1,
          active: 1,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS05')).toBe('FAIL');
  });

  it('warns MS06 when PSV is stale', () => {
    const thirtyDaysAgo = new Date(now.getTime() - 130 * 24 * 60 * 60 * 1000).toISOString();
    const rules = evaluateTjcRules(
      buildSnapshot({
        psv: {
          checkedAt: thirtyDaysAgo,
          isFresh: false,
          freshUntil: thirtyDaysAgo,
          daysRemaining: -10,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS06')).toBe('FAIL');
  });

  it('fails MS06 when NPDB adverse action is present', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        npdb: {
          status: 'ADVERSE_ACTION',
          adverseActionCount: 1,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS06')).toBe('FAIL');
  });

  it('warns MS08 when competency actions remain open', () => {
    const rules = evaluateTjcRules(
      buildSnapshot({
        competency: {
          outstandingActions: 1,
        },
      })
    );
    expect(getStandardStatus(rules, 'MS08')).toBe('WARN');
  });
});

