/**
 * B185C-PAYER-001: PayerEnrollment model v2
 *
 * Clinician-centric enrollment tracking with richer panel types and the new
 * payer enrollment lifecycle.
 */

import { z } from 'zod';

export const PayerEnrollmentV2StatusSchema = z.enum([
  'PENDING',
  'ATTEMPTING',
  'ENROLLED',
  'PANEL_FULL',
  'REJECTED',
  'REVALIDATION_DUE',
]);

export type PayerEnrollmentV2Status = z.infer<typeof PayerEnrollmentV2StatusSchema>;

export const PAYER_ENROLLMENT_V2_TERMINAL_STATUSES: ReadonlySet<PayerEnrollmentV2Status> = new Set([
  'ENROLLED',
  'PANEL_FULL',
  'REJECTED',
]);

export const PayerPanelTypeSchema = z.enum([
  'OPEN',
  'LIMITED',
  'CLOSED',
  'MEDICAID_MANAGED',
  'MEDICARE_ADVANTAGE',
  'SPECIALTY',
]);

export type PayerPanelType = z.infer<typeof PayerPanelTypeSchema>;

export const CreatePayerEnrollmentV2Schema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  payerId: z.string().min(1, 'payerId is required'),
  status: PayerEnrollmentV2StatusSchema.default('PENDING'),
  effectiveDate: z.union([z.date(), z.string().datetime()]).optional(),
  panelType: PayerPanelTypeSchema.default('OPEN'),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreatePayerEnrollmentV2 = z.infer<typeof CreatePayerEnrollmentV2Schema>;

export const UpdatePayerEnrollmentV2Schema = z
  .object({
    status: PayerEnrollmentV2StatusSchema.optional(),
    effectiveDate: z.union([z.date(), z.string().datetime()]).optional(),
    panelType: PayerPanelTypeSchema.optional(),
    notes: z.string().max(4000).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.effectiveDate !== undefined ||
      value.panelType !== undefined ||
      value.notes !== undefined ||
      value.metadata !== undefined,
    {
      message: 'At least one field must be provided to update an enrollment',
    }
  );

export type UpdatePayerEnrollmentV2 = z.infer<typeof UpdatePayerEnrollmentV2Schema>;

export interface PayerEnrollmentV2Record {
  id: string;
  clinicianId: string;
  payerId: string;
  status: PayerEnrollmentV2Status;
  effectiveDate: Date | null;
  panelType: PayerPanelType;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  lastStatusChange: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EnrollmentStatusCategory = 'in_progress' | 'active' | 'blocked' | 'action_required';

const STATUS_CATEGORY_MAP: Record<PayerEnrollmentV2Status, EnrollmentStatusCategory> = {
  PENDING: 'in_progress',
  ATTEMPTING: 'in_progress',
  ENROLLED: 'active',
  PANEL_FULL: 'blocked',
  REJECTED: 'blocked',
  REVALIDATION_DUE: 'action_required',
};

const STATUS_TRANSITIONS: Record<PayerEnrollmentV2Status, PayerEnrollmentV2Status[]> = {
  PENDING: ['ATTEMPTING', 'REJECTED'],
  ATTEMPTING: ['ENROLLED', 'PANEL_FULL', 'REJECTED', 'REVALIDATION_DUE'],
  ENROLLED: ['REVALIDATION_DUE'],
  PANEL_FULL: ['ATTEMPTING'],
  REJECTED: ['ATTEMPTING'],
  REVALIDATION_DUE: ['ATTEMPTING', 'ENROLLED'],
};

export function canTransitionPayerEnrollmentV2(
  current: PayerEnrollmentV2Status,
  next: PayerEnrollmentV2Status
): boolean {
  if (current === next) return true;
  return (STATUS_TRANSITIONS[current] ?? []).includes(next);
}

export function isTerminalPayerEnrollmentV2Status(status: PayerEnrollmentV2Status): boolean {
  return PAYER_ENROLLMENT_V2_TERMINAL_STATUSES.has(status);
}

export function getPayerEnrollmentV2StatusCategory(
  status: PayerEnrollmentV2Status
): EnrollmentStatusCategory {
  return STATUS_CATEGORY_MAP[status];
}

export function normalizePanelType(panelType?: string | null): PayerPanelType {
  if (!panelType) return 'OPEN';
  const upper = panelType.toUpperCase();
  const parsed = PayerPanelTypeSchema.safeParse(upper);
  if (parsed.success) {
    return parsed.data;
  }

  if (upper.includes('OPEN')) return 'OPEN';
  if (upper.includes('MEDICAID')) return 'MEDICAID_MANAGED';
  if (upper.includes('MEDICARE')) return 'MEDICARE_ADVANTAGE';
  if (upper.includes('SPECIAL')) return 'SPECIALTY';
  if (upper.includes('LIMIT')) return 'LIMITED';
  if (upper.includes('CLOSE')) return 'CLOSED';

  return 'OPEN';
}

export function validateCreatePayerEnrollmentV2(payload: unknown): CreatePayerEnrollmentV2 {
  const parsed = CreatePayerEnrollmentV2Schema.parse(payload);
  return {
    ...parsed,
    status: parsed.status ?? 'PENDING',
    panelType: normalizePanelType(parsed.panelType),
    effectiveDate:
      typeof parsed.effectiveDate === 'string'
        ? new Date(parsed.effectiveDate)
        : parsed.effectiveDate,
  };
}

export function validateUpdatePayerEnrollmentV2(payload: unknown): UpdatePayerEnrollmentV2 {
  const parsed = UpdatePayerEnrollmentV2Schema.parse(payload);
  const normalized: UpdatePayerEnrollmentV2 = { ...parsed };

  if (parsed.panelType) {
    normalized.panelType = normalizePanelType(parsed.panelType);
  }

  if (typeof parsed.effectiveDate === 'string') {
    normalized.effectiveDate = new Date(parsed.effectiveDate);
  }

  return normalized;
}
/**
 * B185C-PAYER-001: PayerEnrollment model v2
 *
 * Adds clinicianId-centric tracking with richer panel metadata and the updated
 * enrollment status lifecycle used by the payer network map + eligibility
 * tooling.
 */

import { z } from 'zod';

export const PayerEnrollmentV2StatusSchema = z.enum([
  'PENDING',
  'ATTEMPTING',
  'ENROLLED',
  'PANEL_FULL',
  'REJECTED',
  'REVALIDATION_DUE',
]);

export type PayerEnrollmentV2Status = z.infer<typeof PayerEnrollmentV2StatusSchema>;

export const PAYER_ENROLLMENT_V2_TERMINAL_STATUSES: ReadonlySet<PayerEnrollmentV2Status> = new Set([
  'ENROLLED',
  'PANEL_FULL',
  'REJECTED',
]);

export const PayerPanelTypeSchema = z.enum([
  'OPEN',
  'LIMITED',
  'CLOSED',
  'MEDICAID_MANAGED',
  'MEDICARE_ADVANTAGE',
  'SPECIALTY',
]);

export type PayerPanelType = z.infer<typeof PayerPanelTypeSchema>;

export const CreatePayerEnrollmentV2Schema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  payerId: z.string().min(1, 'payerId is required'),
  status: PayerEnrollmentV2StatusSchema.default('PENDING'),
  effectiveDate: z.union([z.date(), z.string().datetime()]).optional(),
  panelType: PayerPanelTypeSchema.default('OPEN'),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreatePayerEnrollmentV2 = z.infer<typeof CreatePayerEnrollmentV2Schema>;

export const UpdatePayerEnrollmentV2Schema = z
  .object({
    status: PayerEnrollmentV2StatusSchema.optional(),
    effectiveDate: z.union([z.date(), z.string().datetime()]).optional(),
    panelType: PayerPanelTypeSchema.optional(),
    notes: z.string().max(4000).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.effectiveDate !== undefined ||
      value.panelType !== undefined ||
      value.notes !== undefined ||
      value.metadata !== undefined,
    {
      message: 'At least one field must be provided to update an enrollment',
    }
  );

export type UpdatePayerEnrollmentV2 = z.infer<typeof UpdatePayerEnrollmentV2Schema>;

export interface PayerEnrollmentV2Record {
  id: string;
  clinicianId: string;
  payerId: string;
  status: PayerEnrollmentV2Status;
  effectiveDate: Date | null;
  panelType: PayerPanelType;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  lastStatusChange: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EnrollmentStatusCategory = 'in_progress' | 'active' | 'blocked' | 'action_required';

const STATUS_CATEGORY_MAP: Record<PayerEnrollmentV2Status, EnrollmentStatusCategory> = {
  PENDING: 'in_progress',
  ATTEMPTING: 'in_progress',
  ENROLLED: 'active',
  PANEL_FULL: 'blocked',
  REJECTED: 'blocked',
  REVALIDATION_DUE: 'action_required',
};

const STATUS_TRANSITIONS: Record<PayerEnrollmentV2Status, PayerEnrollmentV2Status[]> = {
  PENDING: ['ATTEMPTING', 'REJECTED'],
  ATTEMPTING: ['ENROLLED', 'PANEL_FULL', 'REJECTED', 'REVALIDATION_DUE'],
  ENROLLED: ['REVALIDATION_DUE'],
  PANEL_FULL: ['ATTEMPTING'],
  REJECTED: ['ATTEMPTING'],
  REVALIDATION_DUE: ['ATTEMPTING', 'ENROLLED'],
};

export function canTransitionPayerEnrollmentV2(
  current: PayerEnrollmentV2Status,
  next: PayerEnrollmentV2Status
): boolean {
  if (current === next) return true;
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

export function isTerminalPayerEnrollmentV2Status(status: PayerEnrollmentV2Status): boolean {
  return PAYER_ENROLLMENT_V2_TERMINAL_STATUSES.has(status);
}

export function getPayerEnrollmentV2StatusCategory(
  status: PayerEnrollmentV2Status
): EnrollmentStatusCategory {
  return STATUS_CATEGORY_MAP[status];
}

export function normalizePanelType(panelType?: string | null): PayerPanelType {
  if (!panelType) return 'OPEN';
  const upper = panelType.toUpperCase();
  const parsed = PayerPanelTypeSchema.safeParse(upper);
  if (parsed.success) {
    return parsed.data;
  }

  if (upper.includes('OPEN')) return 'OPEN';
  if (upper.includes('MEDICAID')) return 'MEDICAID_MANAGED';
  if (upper.includes('MEDICARE')) return 'MEDICARE_ADVANTAGE';
  if (upper.includes('SPECIAL')) return 'SPECIALTY';
  if (upper.includes('LIMIT')) return 'LIMITED';
  if (upper.includes('CLOSE')) return 'CLOSED';

  return 'OPEN';
}

export function validateCreatePayerEnrollmentV2(payload: unknown): CreatePayerEnrollmentV2 {
  const parsed = CreatePayerEnrollmentV2Schema.parse(payload);
  return {
    ...parsed,
    status: parsed.status ?? 'PENDING',
    panelType: normalizePanelType(parsed.panelType),
    effectiveDate: typeof parsed.effectiveDate === 'string'
      ? new Date(parsed.effectiveDate)
      : parsed.effectiveDate,
  };
}

export function validateUpdatePayerEnrollmentV2(payload: unknown): UpdatePayerEnrollmentV2 {
  const parsed = UpdatePayerEnrollmentV2Schema.parse(payload);
  const normalized: UpdatePayerEnrollmentV2 = { ...parsed };

  if (parsed.panelType) {
    normalized.panelType = normalizePanelType(parsed.panelType);
  }

  if (typeof parsed.effectiveDate === 'string') {
    normalized.effectiveDate = new Date(parsed.effectiveDate);
  }

  return normalized;
}

