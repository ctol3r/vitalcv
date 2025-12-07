/**
 * B138A-CC-006: Counseling Compact Model
 *
 * Defines the data model and validation for the Counseling Compact eligibility.
 * The Counseling Compact allows licensed professional counselors to practice across state lines.
 */

import { z } from 'zod';

// Counseling Compact Status values
export type CounselingCompactStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'ACTIVE';

// Counseling license types
export const CounselingLicenseTypes = [
  'LPC', // Licensed Professional Counselor
  'LPCC', // Licensed Professional Clinical Counselor
  'LMHC', // Licensed Mental Health Counselor
  'LCMHC', // Licensed Clinical Mental Health Counselor
  'LCPC', // Licensed Clinical Professional Counselor
] as const;

export type CounselingLicenseType = typeof CounselingLicenseTypes[number];

// License data for counseling eligibility
export const CounselingLicenseSchema = z.object({
  state: z.string().length(2),
  licenseNumber: z.string(),
  licenseType: z.enum(CounselingLicenseTypes),
  issueDate: z.string().datetime().or(z.date()),
  expirationDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['active', 'inactive', 'expired', 'revoked']),
  isPrimary: z.boolean().default(false),
});

export type CounselingLicense = z.infer<typeof CounselingLicenseSchema>;

// Counseling Compact validation schema
export const CounselingCompactSchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  homeState: z.string().length(2).optional(),
  compactStates: z.array(z.string().length(2)).default([]),
  status: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'ACTIVE'] as const).default('NOT_ELIGIBLE'),
  licenseType: z.enum(CounselingLicenseTypes).optional(),
  licenseData: z.array(CounselingLicenseSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CounselingCompactData = z.infer<typeof CounselingCompactSchema>;

// Counseling Compact participating states (as of 2024)
// Note: This is a relatively new compact, state participation may vary
export const COUNSELING_COMPACT_STATES = [
  'AL', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IL', 'KS', 'KY', 'MD', 'MS',
  'MO', 'NE', 'NH', 'NC', 'OH', 'OK', 'SC', 'TN', 'TX', 'UT', 'VA', 'WV', 'WI'
] as const;

export type CounselingCompactState = typeof COUNSELING_COMPACT_STATES[number];

// Counseling Compact eligibility requirements
export interface CounselingCompactEligibilityRequirements {
  // Must hold an active, unencumbered license in home state
  hasActiveLicense: boolean;
  // Home state must be a Counseling Compact member
  homeStateIsCompactMember: boolean;
  // Must have a master's degree or higher in counseling or related field
  hasMastersDegree: boolean;
  // Must have completed required supervised experience (typically 3,000 hours)
  hasRequiredExperience: boolean;
  // Must have passed NCE (National Counselor Examination) or NCMHCE
  hasPassedNationalExam: boolean;
  // No disciplinary actions or restrictions
  noDisciplinaryActions: boolean;
  // Background check completed
  backgroundCheckCompleted: boolean;
}

export function validateCounselingCompact(data: unknown): CounselingCompactData {
  return CounselingCompactSchema.parse(data);
}

export function isCounselingCompactState(state: string): state is CounselingCompactState {
  return COUNSELING_COMPACT_STATES.includes(state as CounselingCompactState);
}

// Privilege to Practice types
export interface PrivilegeToPractice {
  state: string;
  issuedDate: Date;
  expirationDate?: Date;
  renewalRequired: boolean;
  status: 'active' | 'inactive' | 'expired' | 'suspended';
}

