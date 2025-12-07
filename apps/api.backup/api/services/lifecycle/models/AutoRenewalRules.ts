/**
 * B238A-LIFE-005: AutoRenewalRules model
 *
 * Defines auto-renewal rules for credentials at organization or global level.
 */

import { z } from 'zod';

/**
 * AutoRenewalRules schema
 */
export const AutoRenewalRulesSchema = z.object({
  id: z.string(),
  orgId: z.string().optional().nullable(),
  credentialType: z.string().min(1, 'credentialType is required'),
  autoRenew: z.boolean().default(false),
  maxRenewals: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AutoRenewalRules = z.infer<typeof AutoRenewalRulesSchema>;

/**
 * Create AutoRenewalRules input schema
 */
export const CreateAutoRenewalRulesInputSchema = z.object({
  orgId: z.string().optional(),
  credentialType: z.string().min(1, 'credentialType is required'),
  autoRenew: z.boolean().default(false),
  maxRenewals: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type CreateAutoRenewalRulesInput = z.infer<typeof CreateAutoRenewalRulesInputSchema>;

/**
 * Update AutoRenewalRules input schema
 */
export const UpdateAutoRenewalRulesInputSchema = z.object({
  autoRenew: z.boolean().optional(),
  maxRenewals: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateAutoRenewalRulesInput = z.infer<typeof UpdateAutoRenewalRulesInputSchema>;

/**
 * Create auto-renewal rules
 */
export function createAutoRenewalRules(input: CreateAutoRenewalRulesInput): Omit<AutoRenewalRules, 'id' | 'createdAt' | 'updatedAt'> {
  return CreateAutoRenewalRulesInputSchema.parse(input);
}

/**
 * Validate auto-renewal rules
 */
export function validateAutoRenewalRules(rules: unknown): AutoRenewalRules {
  return AutoRenewalRulesSchema.parse(rules);
}

