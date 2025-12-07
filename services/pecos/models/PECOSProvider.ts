/**
 * B169A-PECOS-001: PECOSProvider model definition
 */

import { z } from 'zod';

export enum PecosEnrollmentType {
  CMS855I = 'CMS855I',
  CMS855R = 'CMS855R',
  CMS855B = 'CMS855B',
}

export enum PecosProviderStatus {
  ENROLLED = 'ENROLLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  DEACTIVATED = 'DEACTIVATED',
}

const dateLike = z.union([z.date(), z.string()]).nullable().optional();

const BaseSchema = z.object({
  clinicianId: z.string().min(1),
  enrollmentType: z.nativeEnum(PecosEnrollmentType),
  npi: z
    .string()
    .min(10, 'NPI must be 10 digits')
    .max(15, 'NPI cannot exceed 15 characters'),
  medicareId: z.string().min(5).max(30).optional(),
  status: z.nativeEnum(PecosProviderStatus),
  effectiveDate: dateLike,
  revalidationDate: dateLike,
  lastCheckedAt: dateLike,
  metadata: z.record(z.any()).optional(),
});

export const CreatePecosProviderSchema = BaseSchema.extend({
  id: z.string().optional(),
});

export const UpdatePecosProviderSchema = BaseSchema.partial().extend({
  id: z.string().cuid(),
});

export type PecosProviderInput = z.infer<typeof CreatePecosProviderSchema>;
export type UpdatePecosProviderInput = z.infer<typeof UpdatePecosProviderSchema>;

export function parsePecosProvider(data: unknown): PecosProviderInput {
  return CreatePecosProviderSchema.parse(data);
}

export function parsePecosProviderUpdate(data: unknown): UpdatePecosProviderInput {
  return UpdatePecosProviderSchema.parse(data);
}

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

export function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
