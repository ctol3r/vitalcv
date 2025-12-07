/**
 * B209A-STRAT-003: OrgOperationalProfile model
 *
 * Stores organization-specific operational parameters.
 * Tracks specialties, volumes, EHR type, geographic compacts, and payer mix.
 * Matches Prisma model OrgOperationalProfile.
 */

import { z } from 'zod';

/**
 * Operational profile schema
 */
export const OrgOperationalProfileSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),

  // Specialties: Array of specialty codes (e.g., "207R00000X")
  specialties: z.array(z.string()).default([]),

  // Volumes: Case volumes by specialty or department
  volumes: z
    .record(z.string(), z.number())
    .optional()
    .describe('Map of specialty/department codes to case volumes'),

  // EHR type: Electronic Health Record system type
  ehrType: z
    .enum(['epic', 'cerner', 'allscripts', 'athenahealth', 'generic', 'other'])
    .optional(),

  // Geographic compacts: Compact memberships by state
  geographicCompacts: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe('Map of compact types (e.g., "IMLC", "PSYPACT") to state arrays'),

  // Payer mix: Distribution of payers by percentage or volume
  payerMix: z
    .record(z.string(), z.number())
    .optional()
    .describe('Map of payer IDs to percentages (0-1) or volumes'),

  // Metadata for additional operational context
  metadata: z.record(z.unknown()).optional(),

  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type OrgOperationalProfile = z.infer<typeof OrgOperationalProfileSchema>;
export type CreateOrgOperationalProfileInput = z.input<
  typeof OrgOperationalProfileSchema
>;

/**
 * Create an org operational profile
 */
export function createOrgOperationalProfile(
  input: CreateOrgOperationalProfileInput
): OrgOperationalProfile {
  return OrgOperationalProfileSchema.parse(input);
}

/**
 * Validate operational profile
 */
export function validateOrgOperationalProfile(
  profile: unknown
): OrgOperationalProfile {
  return OrgOperationalProfileSchema.parse(profile);
}

/**
 * Get specialties as array
 */
export function getSpecialties(profile: OrgOperationalProfile): string[] {
  return profile.specialties;
}

/**
 * Get payer mix as normalized percentages
 */
export function getNormalizedPayerMix(
  profile: OrgOperationalProfile
): Record<string, number> {
  const payerMix = profile.payerMix || {};
  const total = Object.values(payerMix).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [payerId, value] of Object.entries(payerMix)) {
    normalized[payerId] = value / total;
  }

  return normalized;
}

