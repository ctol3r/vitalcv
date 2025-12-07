/**
 * B170B-FPPE-001: FPPECase model + helpers
 *
 * Defines the domain model for focused professional practice evaluation (FPPE)
 * cases, including checklist tracking, status transitions, and serialization
 * helpers used by API routes and background workers.
 */

import { z } from 'zod';

export const FPPECaseStatusSchema = z.enum(['OPEN', 'IN_REVIEW', 'COMPLETED', 'FAILED']);
export type FPPECaseStatus = z.infer<typeof FPPECaseStatusSchema>;

export const FPPEChecklistItemStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE']);
export type FPPEChecklistItemStatus = z.infer<typeof FPPEChecklistItemStatusSchema>;

export const FPPEEvidenceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  url: z.string().url().optional(),
  uploadedAt: z.string().datetime(),
  uploadedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type FPPEEvidence = z.infer<typeof FPPEEvidenceSchema>;

export const FPPEChecklistItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(true),
  targetCount: z.number().int().nonnegative().optional(),
  completedCount: z.number().int().nonnegative().default(0),
  status: FPPEChecklistItemStatusSchema.default('PENDING'),
  notes: z.string().optional(),
  evidence: z.array(FPPEEvidenceSchema).default([]),
});

export type FPPEChecklistItem = z.infer<typeof FPPEChecklistItemSchema>;

export const FPPEChecklistSchema = z.object({
  version: z.number().int().positive().default(1),
  privilegeCode: z.string().min(1),
  specialty: z.string().optional(),
  items: z.array(FPPEChecklistItemSchema),
});

export type FPPEChecklist = z.infer<typeof FPPEChecklistSchema>;

export const FPPEChecklistItemUpdateSchema = z.object({
  key: z.string().min(1),
  completedCount: z.number().int().nonnegative().optional(),
  status: FPPEChecklistItemStatusSchema.optional(),
  notes: z.string().optional(),
  evidence: z.array(
    FPPEEvidenceSchema.extend({
      uploadedAt: FPPEEvidenceSchema.shape.uploadedAt.default(() => new Date().toISOString()),
    })
  ).optional(),
});

export type FPPEChecklistItemUpdate = z.infer<typeof FPPEChecklistItemUpdateSchema>;

export const CreateFPPECaseSchema = z.object({
  clinicianId: z.string().min(1),
  orgId: z.string().min(1),
  privilegeGrantedId: z.string().min(1),
  privilegeCode: z.string().min(1),
  startAt: z.coerce.date(),
  dueAt: z.coerce.date(),
  status: FPPECaseStatusSchema.default('OPEN'),
  evaluatorId: z.string().optional(),
  checklist: FPPEChecklistSchema.optional(),
  notes: z.string().optional(),
});

export type CreateFPPECaseInput = z.infer<typeof CreateFPPECaseSchema>;

export const UpdateFPPECaseSchema = z.object({
  status: FPPECaseStatusSchema.optional(),
  evaluatorId: z.string().optional(),
  checklist: FPPEChecklistSchema.optional(),
  notes: z.string().optional(),
  completedAt: z.coerce.date().optional(),
});

export type UpdateFPPECaseInput = z.infer<typeof UpdateFPPECaseSchema>;

export function calculateFPPEDueDate(startAt: Date | string, evaluationWindowDays = 30): Date {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const due = new Date(start);
  due.setDate(due.getDate() + evaluationWindowDays);
  return due;
}

export function isFPPEOverdue(caseRecord: { dueAt: Date | string; status: FPPECaseStatus }): boolean {
  if (caseRecord.status === 'COMPLETED') {
    return false;
  }
  const dueAt = caseRecord.dueAt instanceof Date ? caseRecord.dueAt : new Date(caseRecord.dueAt);
  return dueAt.getTime() < Date.now();
}

export function canTransitionFPPECaseStatus(
  current: FPPECaseStatus,
  next: FPPECaseStatus
): { allowed: boolean; reason?: string } {
  const transitions: Record<FPPECaseStatus, FPPECaseStatus[]> = {
    OPEN: ['IN_REVIEW', 'FAILED'],
    IN_REVIEW: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: [],
  };

  if (current === next) {
    return { allowed: true };
  }

  if (transitions[current]?.includes(next)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot transition FPPE status from ${current} to ${next}`,
  };
}

export function normalizeChecklist(
  checklist: unknown,
  options: { privilegeCode?: string; specialty?: string } = {}
): FPPEChecklist {
  const parsed = FPPEChecklistSchema.safeParse(checklist);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    version: 1,
    privilegeCode: options.privilegeCode ?? 'UNKNOWN',
    specialty: options.specialty,
    items: [],
  };
}

export function applyChecklistUpdates(
  checklist: FPPEChecklist,
  updates: FPPEChecklistItemUpdate[]
): FPPEChecklist {
  if (updates.length === 0) {
    return checklist;
  }

  const itemMap = new Map<string, FPPEChecklistItem>(
    checklist.items.map((item) => [item.key, { ...item, evidence: [...item.evidence] }])
  );

  for (const update of updates) {
    const existing = itemMap.get(update.key);
    if (!existing) {
      continue;
    }

    if (typeof update.completedCount === 'number') {
      existing.completedCount = update.completedCount;
    }

    if (typeof update.notes !== 'undefined') {
      existing.notes = update.notes;
    }

    if (update.evidence) {
      existing.evidence = update.evidence.map((entry) => ({
        ...entry,
        uploadedAt: entry.uploadedAt ?? new Date().toISOString(),
      }));
    }

    if (update.status) {
      existing.status = update.status;
    } else if (existing.targetCount && existing.completedCount >= existing.targetCount) {
      existing.status = 'COMPLETE';
    } else if (existing.completedCount > 0 && existing.status === 'PENDING') {
      existing.status = 'IN_PROGRESS';
    }
  }

  return {
    ...checklist,
    items: Array.from(itemMap.values()),
  };
}

export function serializeFPPECase(caseRecord: any) {
  const startAt = caseRecord.startAt instanceof Date ? caseRecord.startAt : new Date(caseRecord.startAt);
  const dueAt = caseRecord.dueAt instanceof Date ? caseRecord.dueAt : new Date(caseRecord.dueAt);
  const completedAt = caseRecord.completedAt
    ? caseRecord.completedAt instanceof Date
      ? caseRecord.completedAt
      : new Date(caseRecord.completedAt)
    : null;
  const checklist = normalizeChecklist(caseRecord.checklist, {
    privilegeCode: caseRecord.privilegeCode,
  });

  return {
    id: caseRecord.id,
    clinicianId: caseRecord.clinicianId,
    orgId: caseRecord.orgId,
    privilegeGrantedId: caseRecord.privilegeGrantedId,
    privilegeCode: caseRecord.privilegeCode,
    startAt: startAt.toISOString(),
    dueAt: dueAt.toISOString(),
    status: caseRecord.status as FPPECaseStatus,
    evaluatorId: caseRecord.evaluatorId ?? null,
    checklist,
    notes: caseRecord.notes ?? null,
    completedAt: completedAt ? completedAt.toISOString() : null,
    createdAt: (caseRecord.createdAt instanceof Date
      ? caseRecord.createdAt
      : new Date(caseRecord.createdAt)
    ).toISOString(),
    updatedAt: (caseRecord.updatedAt instanceof Date
      ? caseRecord.updatedAt
      : new Date(caseRecord.updatedAt)
    ).toISOString(),
    isOverdue: isFPPEOverdue({ dueAt, status: caseRecord.status }),
  };
}
/**
 * B170B-FPPE-001: FPPECase model + validation helpers
 *
 * Stores pending FPPE reviews that every newly granted privilege must complete.
 * Tracks clinician + org, assigned privilege code, evaluator, and due date.
 */

import { z } from 'zod';

export enum FPPECaseStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type FPPECaseStatusType = FPPECaseStatus;

export const ChecklistMetricSchema = z.object({
  required: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export type ChecklistMetric = z.infer<typeof ChecklistMetricSchema>;

export const FPPEEvidenceChecklistSchema = z.object({
  chartsReviewed: ChecklistMetricSchema,
  supervisedCases: ChecklistMetricSchema,
  outcomes: ChecklistMetricSchema.extend({
    adverseEvents: z.number().int().nonnegative().default(0),
    successful: z.number().int().nonnegative().default(0),
  }),
});

export type FPPEEvidenceChecklist = z.infer<typeof FPPEEvidenceChecklistSchema>;

const FPPEStatusEnum = z.nativeEnum(FPPECaseStatus);

export const CreateFPPECaseSchema = z.object({
  clinicianId: z.string().min(1, 'Clinician ID is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  privilegeGrantedId: z.string().min(1, 'Privilege grant ID is required'),
  privilegeCode: z.string().min(1, 'Privilege code is required'),
  startAt: z.coerce.date(),
  dueAt: z.coerce.date(),
  status: FPPEStatusEnum.default(FPPECaseStatus.OPEN),
  evaluatorId: z.string().optional(),
  checklist: FPPEEvidenceChecklistSchema.optional(),
  notes: z.string().max(5000).optional(),
});

export type CreateFPPECaseInput = z.infer<typeof CreateFPPECaseSchema>;

export const UpdateFPPECaseSchema = z.object({
  status: FPPEStatusEnum.optional(),
  evaluatorId: z.string().optional(),
  dueAt: z.coerce.date().optional(),
  checklist: FPPEEvidenceChecklistSchema.partial().optional(),
  notes: z.string().max(5000).optional().nullable(),
  completedAt: z.coerce.date().optional(),
});

export type UpdateFPPECaseInput = z.infer<typeof UpdateFPPECaseSchema>;

export const QueryFPPECaseSchema = z.object({
  orgId: z.string().optional(),
  clinicianId: z.string().optional(),
  status: FPPEStatusEnum.optional(),
  overdue: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type QueryFPPECaseInput = z.infer<typeof QueryFPPECaseSchema>;

export interface FPPECaseRecord {
  id: string;
  clinicianId: string;
  orgId: string;
  privilegeGrantedId: string;
  privilegeCode: string;
  startAt: Date;
  dueAt: Date;
  status: FPPECaseStatusType;
  evaluatorId?: string | null;
  checklist?: FPPEEvidenceChecklist | null;
  notes?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeFPPECase(record: FPPECaseRecord) {
  return {
    id: record.id,
    clinicianId: record.clinicianId,
    orgId: record.orgId,
    privilegeGrantedId: record.privilegeGrantedId,
    privilegeCode: record.privilegeCode,
    startAt: record.startAt.toISOString(),
    dueAt: record.dueAt.toISOString(),
    status: record.status,
    evaluatorId: record.evaluatorId ?? null,
    checklist: record.checklist ?? null,
    notes: record.notes ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    overdue: isFPPECaseOverdue(record),
  };
}

const CASE_STATUS_TRANSITIONS: Record<FPPECaseStatusType, FPPECaseStatusType[]> = {
  OPEN: [FPPECaseStatus.IN_REVIEW, FPPECaseStatus.COMPLETED, FPPECaseStatus.FAILED],
  IN_REVIEW: [FPPECaseStatus.COMPLETED, FPPECaseStatus.FAILED, FPPECaseStatus.OPEN],
  COMPLETED: [],
  FAILED: [FPPECaseStatus.OPEN],
};

export function canTransitionFPPECaseStatus(
  current: FPPECaseStatusType,
  next: FPPECaseStatusType
): { allowed: boolean; reason?: string } {
  const allowedNext = CASE_STATUS_TRANSITIONS[current] || [];
  if (allowedNext.includes(next)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Cannot transition FPPE case from ${current} to ${next}`,
  };
}

export function calculateFPPEDueDate(startAt: Date, days = 30): Date {
  const dueDate = new Date(startAt);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}

export function isFPPECaseOverdue(
  record: Pick<FPPECaseRecord, 'dueAt' | 'status'> | { dueAt: Date; status: FPPECaseStatusType },
  referenceDate: Date = new Date()
): boolean {
  if ([FPPECaseStatus.COMPLETED, FPPECaseStatus.FAILED].includes(record.status)) {
    return false;
  }
  return record.dueAt.getTime() < referenceDate.getTime();
}

