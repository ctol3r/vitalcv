/**
 * B238A-LIFE-002: RenewalRequest model
 *
 * Tracks renewal requests for credentials with status, reason, and renewal data.
 */

import { z } from 'zod';

/**
 * Renewal request status enum
 */
export enum RenewalRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

/**
 * RenewalRequest schema
 */
export const RenewalRequestSchema = z.object({
  id: z.string(),
  credentialId: z.string().min(1, 'credentialId is required'),
  requesterId: z.string().min(1, 'requesterId is required'),
  status: z.nativeEnum(RenewalRequestStatus),
  reason: z.string().optional(),
  submittedAt: z.coerce.date(),
  decisionAt: z.coerce.date().optional().nullable(),
  renewalData: z.record(z.unknown()).optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RenewalRequest = z.infer<typeof RenewalRequestSchema>;

/**
 * Create RenewalRequest input schema
 */
export const CreateRenewalRequestInputSchema = z.object({
  credentialId: z.string().min(1, 'credentialId is required'),
  requesterId: z.string().min(1, 'requesterId is required'),
  reason: z.string().optional(),
  renewalData: z.record(z.unknown()).optional(),
});

export type CreateRenewalRequestInput = z.infer<typeof CreateRenewalRequestInputSchema>;

/**
 * Update RenewalRequest input schema (for status changes)
 */
export const UpdateRenewalRequestInputSchema = z.object({
  status: z.nativeEnum(RenewalRequestStatus),
  reason: z.string().optional(),
  renewalData: z.record(z.unknown()).optional(),
});

export type UpdateRenewalRequestInput = z.infer<typeof UpdateRenewalRequestInputSchema>;

/**
 * Create a renewal request
 */
export function createRenewalRequest(input: CreateRenewalRequestInput): Omit<RenewalRequest, 'id' | 'status' | 'submittedAt' | 'decisionAt' | 'createdAt' | 'updatedAt'> {
  return CreateRenewalRequestInputSchema.parse(input);
}

/**
 * Validate renewal request
 */
export function validateRenewalRequest(request: unknown): RenewalRequest {
  return RenewalRequestSchema.parse(request);
}

