/**
 * B238A-LIFE-007: Revocation model
 *
 * Tracks credential revocations with reason, status, and effective date.
 */

import { z } from 'zod';

/**
 * Revocation status enum
 */
export enum RevocationStatus {
  PENDING = 'PENDING',
  REVOKED = 'REVOKED',
}

/**
 * Revocation schema
 */
export const RevocationSchema = z.object({
  id: z.string(),
  credentialId: z.string().min(1, 'credentialId is required'),
  initiatorId: z.string().min(1, 'initiatorId is required'),
  reason: z.string().min(1, 'reason is required'),
  status: z.nativeEnum(RevocationStatus),
  effectiveAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Revocation = z.infer<typeof RevocationSchema>;

/**
 * Create Revocation input schema
 */
export const CreateRevocationInputSchema = z.object({
  credentialId: z.string().min(1, 'credentialId is required'),
  initiatorId: z.string().min(1, 'initiatorId is required'),
  reason: z.string().min(1, 'reason is required'),
  effectiveAt: z.coerce.date(),
});

export type CreateRevocationInput = z.infer<typeof CreateRevocationInputSchema>;

/**
 * Update Revocation input schema (for status changes)
 */
export const UpdateRevocationInputSchema = z.object({
  status: z.nativeEnum(RevocationStatus),
});

export type UpdateRevocationInput = z.infer<typeof UpdateRevocationInputSchema>;

/**
 * Create a revocation
 */
export function createRevocation(input: CreateRevocationInput): Omit<Revocation, 'id' | 'status' | 'createdAt' | 'updatedAt'> {
  return CreateRevocationInputSchema.parse(input);
}

/**
 * Validate revocation
 */
export function validateRevocation(revocation: unknown): Revocation {
  return RevocationSchema.parse(revocation);
}

