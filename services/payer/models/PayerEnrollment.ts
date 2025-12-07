/**
 * B137A-PAYER-001: PayerEnrollment model
 *
 * Tracks payer enrollment status for clinicians with CAQH and PECOS integration.
 * Status lifecycle: DRAFT → SUBMITTED → APPROVED/DENIED → TERMINATED
 */

import { z } from 'zod';
import { EnrollmentStatus, canTransitionStatus } from '@domain-common/payer/enrollment';

export { EnrollmentStatus, canTransitionStatus } from '@domain-common/payer/enrollment';

// B212A-ENROLL-001: Failure reason enum for payer enrollment
export enum PayerEnrollmentFailureReason {
  MISSING_DOCS = 'MISSING_DOCS',
  REJECTED = 'REJECTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PAYER_PANEL_FULL = 'PAYER_PANEL_FULL',
}


// Validation schema for creating enrollment
export const CreatePayerEnrollmentSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  payerId: z.string().min(1, 'Payer ID is required'),
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  caqhId: z.string().optional(),
  pecosId: z.string().optional(),
  evidenceIds: z.array(z.string()).optional().default([]),
  evidenceBundle: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreatePayerEnrollment = z.infer<typeof CreatePayerEnrollmentSchema>;

// Schema for updating enrollment
export const UpdatePayerEnrollmentSchema = z.object({
  caqhId: z.string().optional(),
  pecosId: z.string().optional(),
  pecosEnrollmentId: z.string().optional(),
  pecosStatus: z.string().optional(),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  evidenceIds: z.array(z.string()).optional(),
  evidenceBundle: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(), // B212A-ENROLL-001
  failureReason: z.nativeEnum(PayerEnrollmentFailureReason).optional(), // B212A-ENROLL-001
});

export type UpdatePayerEnrollment = z.infer<typeof UpdatePayerEnrollmentSchema>;

// Complete enrollment record
export interface PayerEnrollmentRecord {
  id: string;
  orgId: string;
  payerId: string;
  clinicianDid: string;
  caqhId: string | null;
  pecosId: string | null;
  pecosEnrollmentId: string | null;
  pecosStatus: string | null;
  status: EnrollmentStatus;
  evidenceIds: string[];
  evidenceBundle?: any;
  submittedAt: Date | null;
  approvedAt: Date | null;
  terminatedAt: Date | null;
  lastCheckedAt: Date | null;
  revalidationDueAt: Date | null;
  anchoredHash: string | null;
  confidenceScore: number | null; // B212A-ENROLL-001: 0-1 confidence score
  failureReason: PayerEnrollmentFailureReason | null; // B212A-ENROLL-001
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Enrollment with payer details
export interface PayerEnrollmentWithPayer extends PayerEnrollmentRecord {
  payer: {
    id: string;
    payerId: string;
    name: string;
    planTypes: string[];
    requiresCaqh: boolean;
    requiresPecos: boolean;
  };
}

// PECOS revalidation intervals
export const PECOS_REVALIDATION_CYCLES = {
  STANDARD: { years: 5, label: '5-year cycle' },
  DMEPOS: { years: 3, label: '3-year DMEPOS cycle' },
} as const;

// Helper to calculate next revalidation date
export function calculateRevalidationDate(
  approvedDate: Date,
  cycle: 'STANDARD' | 'DMEPOS' = 'STANDARD'
): Date {
  const config = PECOS_REVALIDATION_CYCLES[cycle];
  const revalidationDate = new Date(approvedDate);
  revalidationDate.setFullYear(revalidationDate.getFullYear() + config.years);
  return revalidationDate;
}

// Helper to check if revalidation is due soon
export function isRevalidationDueSoon(
  revalidationDate: Date | null,
  daysThreshold: number = 90
): boolean {
  if (!revalidationDate) return false;
  const now = new Date();
  const diffMs = revalidationDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= daysThreshold && diffDays >= 0;
}

export function validateEnrollment(data: unknown): CreatePayerEnrollment {
  return CreatePayerEnrollmentSchema.parse(data);
}

export function validateEnrollmentUpdate(data: unknown): UpdatePayerEnrollment {
  return UpdatePayerEnrollmentSchema.parse(data);
}

