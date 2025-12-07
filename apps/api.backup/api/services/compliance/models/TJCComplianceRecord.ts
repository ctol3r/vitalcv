import { z } from 'zod';

export const TJCStandards = ['MS01', 'MS03', 'MS05', 'MS06', 'MS08'] as const;
export type TJCStandard = (typeof TJCStandards)[number];

export const TJCComplianceStatuses = ['PASS', 'WARN', 'FAIL', 'PENDING'] as const;
export type TJCComplianceStatus = (typeof TJCComplianceStatuses)[number];

export const TJCRuleEvaluationSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  standard: z.enum(TJCStandards),
  status: z.enum(TJCComplianceStatuses),
  summary: z.string(),
  detail: z.string().optional(),
  references: z.array(z.string()).default([]),
  signal: z.string(),
  weight: z.number().positive().default(1),
  remediation: z.string().optional(),
  evidence: z.record(z.any()).optional(),
});

export type TJCRuleEvaluation = z.infer<typeof TJCRuleEvaluationSchema>;

export const TJCStandardResultSchema = z.object({
  standard: z.enum(TJCStandards),
  status: z.enum(TJCComplianceStatuses),
  score: z.number().min(0).max(1),
  summary: z.string(),
  passingRules: z.number().int().nonnegative(),
  failingRules: z.number().int().nonnegative(),
  ruleIds: z.array(z.string()),
});

export type TJCStandardResult = z.infer<typeof TJCStandardResultSchema>;

export const TJCSnapshotFPPESchema = z
  .object({
    completedCount: z.number().int().nonnegative().default(0),
    openCount: z.number().int().nonnegative().default(0),
    overdueCount: z.number().int().nonnegative().default(0),
    lastCompletedAt: z.string().optional(),
    lastStartedAt: z.string().optional(),
  })
  .partial();

export const TJCSnapshotOPPESchema = z
  .object({
    activeCases: z.number().int().nonnegative().default(0),
    failedCases: z.number().int().nonnegative().default(0),
    overdueCases: z.number().int().nonnegative().default(0),
    lastReviewAt: z.string().optional(),
    metrics: z
      .object({
        caseCount: z.number().optional(),
        complications: z.number().optional(),
        issuesFlagged: z.number().optional(),
        licenseIssues: z.number().optional(),
        boardAlerts: z.number().optional(),
        deaFindings: z.number().optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export const TJCSnapshotPrivilegeSchema = z
  .object({
    active: z.number().int().nonnegative().default(0),
    expiringSoon: z.number().int().nonnegative().default(0),
    expired: z.number().int().nonnegative().default(0),
    suspended: z.number().int().nonnegative().default(0),
    temporary: z.number().int().nonnegative().default(0),
  })
  .partial();

export const TJCSnapshotLicenseSchema = z
  .object({
    total: z.number().int().nonnegative().default(0),
    active: z.number().int().nonnegative().default(0),
    expired: z.number().int().nonnegative().default(0),
    expiringSoon: z.number().int().nonnegative().default(0),
    restricted: z.number().int().nonnegative().default(0),
    disciplinaryFlags: z.number().int().nonnegative().default(0),
  })
  .partial();

export const TJCSnapshotPSVSchema = z
  .object({
    checkedAt: z.string().optional(),
    freshUntil: z.string().optional(),
    isFresh: z.boolean().default(false),
    daysRemaining: z.number().optional(),
    overallStatus: z.string().optional(),
  })
  .partial();

export const TJCSnapshotMonitorSchema = z
  .object({
    lastCheckedAt: z.string().optional(),
    status: z.string().optional(),
    adverseActionCount: z.number().int().nonnegative().default(0),
  })
  .partial();

export const TJCSnapshotCompetencySchema = z
  .object({
    oppeStatus: z.string().optional(),
    fppeStatus: z.string().optional(),
    outstandingActions: z.number().int().nonnegative().default(0),
  })
  .partial();

export const TJCSnapshotEnrollmentSchema = z
  .object({
    total: z.number().int().nonnegative().default(0),
    active: z.number().int().nonnegative().default(0),
    revalidationDue: z.number().int().nonnegative().default(0),
  })
  .partial();

export const TJCSignalSnapshotSchema = z.object({
  generatedAt: z.string(),
  clinicianId: z.string(),
  orgId: z.string().nullable().optional(),
  clinicianDid: z.string().optional(),
  fppe: TJCSnapshotFPPESchema.optional(),
  oppe: TJCSnapshotOPPESchema.optional(),
  privileges: TJCSnapshotPrivilegeSchema.optional(),
  licenses: TJCSnapshotLicenseSchema.optional(),
  psv: TJCSnapshotPSVSchema.optional(),
  npdb: TJCSnapshotMonitorSchema.optional(),
  sanctions: TJCSnapshotMonitorSchema.optional(),
  competency: TJCSnapshotCompetencySchema.optional(),
  enrollment: TJCSnapshotEnrollmentSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export type TJCSignalSnapshot = z.infer<typeof TJCSignalSnapshotSchema>;

const STATUS_ORDER: Record<TJCComplianceStatus, number> = {
  PASS: 0,
  PENDING: 1,
  WARN: 2,
  FAIL: 3,
};

export function worseStatus(
  current: TJCComplianceStatus,
  incoming: TJCComplianceStatus
): TJCComplianceStatus {
  return STATUS_ORDER[incoming] > STATUS_ORDER[current] ? incoming : current;
}

export interface SummarizeStandardsResult {
  standardResults: Record<TJCStandard, TJCStandardResult>;
  overallStatus: TJCComplianceStatus;
  recommendations: string[];
}

export function summarizeStandardsFromRules(
  ruleResults: TJCRuleEvaluation[]
): SummarizeStandardsResult {
  const normalized = ruleResults.map((rule) => TJCRuleEvaluationSchema.parse(rule));
  const results: Record<TJCStandard, TJCStandardResult> = {} as Record<TJCStandard, TJCStandardResult>;

  for (const standard of TJCStandards) {
    const relevant = normalized.filter((rule) => rule.standard === standard);
    if (!relevant.length) {
      results[standard] = {
        standard,
        status: 'PENDING',
        score: 0,
        summary: 'No evidence available for this standard.',
        passingRules: 0,
        failingRules: 0,
        ruleIds: [],
      };
      continue;
    }

    const totalWeight = relevant.reduce((sum, rule) => sum + (rule.weight ?? 1), 0);
    const weightedScore = relevant.reduce((sum, rule) => {
      if (rule.status === 'PASS') {
        return sum + (rule.weight ?? 1);
      }
      if (rule.status === 'WARN' || rule.status === 'PENDING') {
        return sum + (rule.weight ?? 1) * 0.5;
      }
      return sum;
    }, 0);

    const standardStatus = relevant.reduce<TJCComplianceStatus>(
      (acc, rule) => worseStatus(acc, rule.status),
      'PASS'
    );

    const failingRules = relevant.filter((rule) => rule.status === 'FAIL').length;
    const summary =
      failingRules > 0
        ? `${failingRules} rule${failingRules > 1 ? 's' : ''} failing for ${standard}`
        : `${relevant.length} rule${relevant.length > 1 ? 's' : ''} evaluated`;

    results[standard] = {
      standard,
      status: standardStatus,
      score: totalWeight ? Number((weightedScore / totalWeight).toFixed(2)) : 0,
      summary,
      passingRules: relevant.length - failingRules,
      failingRules,
      ruleIds: relevant.map((rule) => rule.ruleId),
    };
  }

  const overallStatus = (Object.values(results) as TJCStandardResult[]).reduce<TJCComplianceStatus>(
    (acc, standardResult) => worseStatus(acc, standardResult.status),
    'PASS'
  );

  const recommendations = normalized
    .filter((rule) => rule.status !== 'PASS' && rule.remediation)
    .map((rule) => rule.remediation!)
    .slice(0, 10);

  return {
    standardResults: results,
    overallStatus,
    recommendations,
  };
}

export function buildIssueCodes(ruleResults: TJCRuleEvaluation[]): string[] {
  return ruleResults
    .filter((rule) => rule.status !== 'PASS')
    .map((rule) => rule.ruleId);
}
