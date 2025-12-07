/**
 * B178C-COMPACT-011: Compact Consent Model
 *
 * Clinicians must explicitly opt into sharing compact eligibility data
 * with organizations. This model tracks their consent per compact type.
 */

import { z } from 'zod';

// Supported compact consent types
export const CompactConsentTypes = ['IMLC', 'PSYPACT', 'COUNSELING'] as const;
export type CompactConsentType = typeof CompactConsentTypes[number];

// Compact consent validation schema
export const CompactConsentSchema = z.object({
  clinicianId: z.string().min(1, 'Clinician ID is required'),
  compactType: z.enum(CompactConsentTypes),
  consentGivenAt: z.string().datetime().or(z.date()),
});

export type CompactConsentData = z.infer<typeof CompactConsentSchema>;

/**
 * Validate raw data against the compact consent schema.
 */
export function validateCompactConsent(data: unknown): CompactConsentData {
  return CompactConsentSchema.parse(data);
}

/**
 * Build a Set of consented compact types for quick lookups.
 */
export function buildCompactConsentSet(
  consents: Array<{ compactType: string }>,
): Set<CompactConsentType> {
  const allowed = new Set<CompactConsentType>(CompactConsentTypes);
  return new Set(
    consents
      .map((consent) => consent.compactType)
      .filter((type): type is CompactConsentType => allowed.has(type as CompactConsentType)),
  );
}

/**
 * Check whether a clinician has consented to a specific compact type.
 */
export function hasCompactConsent(
  consents: Set<CompactConsentType>,
  compactType: CompactConsentType,
): boolean {
  return consents.has(compactType);
}

