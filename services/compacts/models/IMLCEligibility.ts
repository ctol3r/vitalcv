/**
 * B138A-IMLC-001: Interstate Medical Licensure Compact (IMLC) Eligibility Model
 *
 * Defines the data model and validation for IMLC eligibility status.
 * IMLC allows physicians to practice across state lines with expedited licensure.
 */

import { z } from 'zod';

// IMLC Status values
export type IMLCStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'LICENSED';

// License history entry for eligibility determination
export const LicenseHistorySchema = z.object({
  state: z.string().length(2),
  licenseNumber: z.string(),
  issueDate: z.string().datetime().or(z.date()),
  expirationDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['active', 'inactive', 'expired', 'revoked']),
  isPrimary: z.boolean().default(false),
  disciplinaryActions: z.array(z.object({
    date: z.string().datetime().or(z.date()),
    type: z.string(),
    description: z.string().optional(),
  })).optional(),
});

export type LicenseHistory = z.infer<typeof LicenseHistorySchema>;

// IMLC Eligibility validation schema
export const IMLCEligibilitySchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  homeState: z.string().length(2, 'Home state must be 2-letter code'),
  compactStates: z.array(z.string().length(2)).default([]),
  status: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'LICENSED'] as const).default('NOT_ELIGIBLE'),
  licenseHistory: z.array(LicenseHistorySchema).optional(),
  metadata: z.record(z.any()).optional(),
});

export type IMLCEligibilityData = z.infer<typeof IMLCEligibilitySchema>;

// IMLC participating states (as of 2024)
export const IMLC_STATES = [
  'AL', 'AK', 'AZ', 'CO', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NC', 'ND', 'OH', 'OK', 'PA', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA',
  'WA', 'WV', 'WI', 'WY'
] as const;

export type IMLCState = typeof IMLC_STATES[number];

// IMLC eligibility requirements
export interface IMLCEligibilityRequirements {
  // Must have a full, unrestricted medical license in a participating state
  hasUnrestrictedLicense: boolean;
  // Home state must be an IMLC member
  homeStateIsIMLCMember: boolean;
  // Must not have any pending investigations or disciplinary actions
  noPendingActions: boolean;
  // Must have no history of disciplinary actions (with some exceptions)
  noDisciplinaryHistory: boolean;
  // Must have completed at least one year of practice
  hasMinimumPracticeTime: boolean;
  // Must have passed USMLE or COMLEX
  hasPassedBoardExam: boolean;
}

export function validateIMLCEligibility(data: unknown): IMLCEligibilityData {
  return IMLCEligibilitySchema.parse(data);
}

export function isIMLCState(state: string): state is IMLCState {
  return IMLC_STATES.includes(state as IMLCState);
}

