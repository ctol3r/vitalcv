/**
 * B170C-OPPE-003: OPPECase model + helpers
 */

import { z } from 'zod';
import {
  OPPE_CASE_STATUS_VALUES,
  type OPPECaseMetrics as OPPECaseMetricsContract,
  type OPPECaseStatus as OPPECaseStatusContract,
} from '@domain-common/qualityContracts';

export const OPPECaseStatusSchema = z.enum(OPPE_CASE_STATUS_VALUES);
type _OppeStatusContractCheck = OPPECaseStatusContract extends z.infer<typeof OPPECaseStatusSchema>
  ? true
  : never;
export type OPPECaseStatus = z.infer<typeof OPPECaseStatusSchema>;

export const OPPECaseMetricsSchema = z.object({
  caseCount: z.number().nonnegative().default(0),
  complications: z.number().nonnegative().default(0),
  issuesFlagged: z.number().nonnegative().default(0),
  licenseIssues: z.number().nonnegative().default(0),
  boardAlerts: z.number().nonnegative().default(0),
  deaFindings: z.number().nonnegative().default(0),
  lastEventAt: z.string().datetime().optional(),
});

type _OppeMetricsContractCheck = OPPECaseMetricsContract extends z.infer<typeof OPPECaseMetricsSchema>
  ? (z.infer<typeof OPPECaseMetricsSchema> extends OPPECaseMetricsContract ? true : never)
  : never;
export type OPPECaseMetrics = z.infer<typeof OPPECaseMetricsSchema>;

export const CreateOPPECaseSchema = z.object({
  scheduleId: z.string().min(1),
  clinicianId: z.string().min(1),
  orgId: z.string().min(1),
  privilegeGrantedId: z.string().optional(),
  privilegeCode: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  metrics: OPPECaseMetricsSchema.optional(),
  status: OPPECaseStatusSchema.default('OPEN'),
});

export type CreateOPPECaseInput = z.infer<typeof CreateOPPECaseSchema>;

export const UpdateOPPECaseSchema = z.object({
  metrics: OPPECaseMetricsSchema.partial().optional(),
  status: OPPECaseStatusSchema.optional(),
  reviewerId: z.string().optional(),
  reviewedAt: z.coerce.date().optional(),
});

export type UpdateOPPECaseInput = z.infer<typeof UpdateOPPECaseSchema>;

export function serializeOPPECase(caseRecord: any) {
  return {
    id: caseRecord.id,
    clinicianId: caseRecord.clinicianId,
    orgId: caseRecord.orgId,
    privilegeCode: caseRecord.privilegeCode,
    periodStart: new Date(caseRecord.periodStart).toISOString(),
    periodEnd: new Date(caseRecord.periodEnd).toISOString(),
    status: caseRecord.status as OPPECaseStatus,
    metrics: normalizeMetrics(caseRecord.metrics),
    reviewerId: caseRecord.reviewerId ?? null,
    reviewedAt: caseRecord.reviewedAt ? new Date(caseRecord.reviewedAt).toISOString() : null,
    createdAt: caseRecord.createdAt?.toISOString?.() ?? new Date(caseRecord.createdAt).toISOString(),
    updatedAt: caseRecord.updatedAt?.toISOString?.() ?? new Date(caseRecord.updatedAt).toISOString(),
  };
}

export function normalizeMetrics(metrics: unknown): OPPECaseMetrics {
  const parsed = OPPECaseMetricsSchema.safeParse(metrics ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  return OPPECaseMetricsSchema.parse({});
}

export function initializeMetricsFromTargets(
  metricsConfig: Record<string, number> | undefined
): OPPECaseMetrics {
  const defaults = OPPECaseMetricsSchema.parse({});
  if (!metricsConfig) return defaults;

  return {
    ...defaults,
    caseCount: metricsConfig.cases ?? defaults.caseCount,
    complications: metricsConfig.complications ?? defaults.complications,
  };
}

export function mergeMetrics(
  current: OPPECaseMetrics,
  delta: Partial<OPPECaseMetrics> & { lastEventAt?: string }
): OPPECaseMetrics {
  const merged = {
    ...current,
    ...Object.entries(delta).reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === 'number' && value >= 0) {
        acc[key] = value;
      }
      return acc;
    }, {}),
  } as OPPECaseMetrics;

  if (delta.lastEventAt) {
    merged.lastEventAt = delta.lastEventAt;
  }

  return merged;
}
