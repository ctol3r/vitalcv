/**
 * B238A-LIFE-001: CredentialExpiryPolicy model
 *
 * Defines expiry policies for different credential types with default validity periods,
 * grace periods, and renewal requirements.
 */

import { z } from 'zod';

/**
 * Renewal requirements schema
 */
export const RenewalRequirementsSchema = z.object({
  requiresDocumentation: z.boolean().optional(),
  requiresPayment: z.boolean().optional(),
  requiresTraining: z.boolean().optional(),
  requiresExamination: z.boolean().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  minDaysBeforeExpiry: z.number().optional(), // Minimum days before expiry to start renewal
  maxDaysAfterExpiry: z.number().optional(), // Maximum days after expiry to renew
  additionalRequirements: z.record(z.unknown()).optional(),
});

export type RenewalRequirements = z.infer<typeof RenewalRequirementsSchema>;

/**
 * CredentialExpiryPolicy schema
 */
export const CredentialExpiryPolicySchema = z.object({
  id: z.string(),
  credentialType: z.string().min(1, 'credentialType is required'),
  defaultValidityPeriod: z.number().int().positive('defaultValidityPeriod must be positive'),
  gracePeriod: z.number().int().nonnegative('gracePeriod must be non-negative'),
  renewalRequirements: RenewalRequirementsSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CredentialExpiryPolicy = z.infer<typeof CredentialExpiryPolicySchema>;

/**
 * Create CredentialExpiryPolicy input schema
 */
export const CreateCredentialExpiryPolicyInputSchema = z.object({
  credentialType: z.string().min(1, 'credentialType is required'),
  defaultValidityPeriod: z.number().int().positive('defaultValidityPeriod must be positive'),
  gracePeriod: z.number().int().nonnegative('gracePeriod must be non-negative'),
  renewalRequirements: RenewalRequirementsSchema.optional(),
});

export type CreateCredentialExpiryPolicyInput = z.infer<typeof CreateCredentialExpiryPolicyInputSchema>;

/**
 * Update CredentialExpiryPolicy input schema
 */
export const UpdateCredentialExpiryPolicyInputSchema = z.object({
  defaultValidityPeriod: z.number().int().positive().optional(),
  gracePeriod: z.number().int().nonnegative().optional(),
  renewalRequirements: RenewalRequirementsSchema.optional(),
});

export type UpdateCredentialExpiryPolicyInput = z.infer<typeof UpdateCredentialExpiryPolicyInputSchema>;

/**
 * Create a credential expiry policy
 */
export function createCredentialExpiryPolicy(input: CreateCredentialExpiryPolicyInput): Omit<CredentialExpiryPolicy, 'id' | 'createdAt' | 'updatedAt'> {
  return CreateCredentialExpiryPolicyInputSchema.parse(input);
}

/**
 * Validate credential expiry policy
 */
export function validateCredentialExpiryPolicy(policy: unknown): CredentialExpiryPolicy {
  return CredentialExpiryPolicySchema.parse(policy);
}

