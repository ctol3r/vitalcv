/**
 * B169A-PECOS-001: PECOSProvider model definition
 *
 * Tracks Medicare PECOS enrollment metadata for each clinician.
 */

import { z } from 'zod';

/**
 * Supported CMS PECOS form types.
 *
 * We align provider enrollment type with the CMS 855 form that was last filed.
 */
export enum PecosEnrollmentType {
  CMS855I = 'CMS855I', // Individual enrollment
  CMS855R = 'CMS855R', // Reassignment of benefits
  CMS855B = 'CMS855B', // Group/billing enrollment
}

/**
 * Normalized PECOS enrollment states surfaced to downstream systems.
 */
export enum PecosProviderStatus {
  ENROLLED = 'ENROLLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  DEACTIVATED = 'DEACTIVATED',
}

const dateLike = z.union([z.date(), z.string()]).nullable().optional();

const BasePecosProviderSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  enrollmentType: z.nativeEnum(PecosEnrollmentType),
  npi: z
    .string()
    .min(10, 'NPI must be 10 digits')
    .max(15, 'NPI cannot exceed 15 characters'),
  medicareId: z
    .string()
    .min(5, 'Medicare ID must be at least 5 characters')
    .max(30, 'Medicare ID cannot exceed 30 characters')
    .optional(),
  status: z.nativeEnum(PecosProviderStatus),
  effectiveDate: dateLike,
  revalidationDate: dateLike,
  lastCheckedAt: dateLike,
  metadata: z.record(z.any()).optional(),
});

export const CreatePecosProviderSchema = BasePecosProviderSchema.extend({
  id: z.string().optional(),
});

export const UpdatePecosProviderSchema = BasePecosProviderSchema.partial().extend({
  id: z.string().cuid('Valid provider id is required when updating'),
});

export type PecosProviderInput = z.infer<typeof CreatePecosProviderSchema>;
export type UpdatePecosProviderInput = z.infer<typeof UpdatePecosProviderSchema>;

/**
 * Helper to coerce unknown input into a validated PECOSProvider payload.
 */
export function parsePecosProvider(data: unknown): PecosProviderInput {
  return CreatePecosProviderSchema.parse(data);
}

/**
 * Helper to coerce partial updates.
 */
export function parsePecosProviderUpdate(data: unknown): UpdatePecosProviderInput {
  return UpdatePecosProviderSchema.parse(data);
}

/**
 * Maps normalized PECOS provider status to the PayerEnrollment status string.
 */
export function mapProviderStatusToEnrollment(
  status: PecosProviderStatus
): 'APPROVED' | 'SUBMITTED' | 'DENIED' | 'TERMINATED' {
  switch (status) {
    case PecosProviderStatus.ENROLLED:
      return 'APPROVED';
    case PecosProviderStatus.PENDING:
      return 'SUBMITTED';
    case PecosProviderStatus.REJECTED:
      return 'DENIED';
    case PecosProviderStatus.DEACTIVATED:
    default:
      return 'TERMINATED';
  }
}

/**
 * Utility to coerce any supported date-like value into a Date.
 */
export function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

