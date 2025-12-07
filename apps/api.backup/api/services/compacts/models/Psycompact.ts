/**
 * B138A-PSY-004: PSYPACT (Psychology Interjurisdictional Compact) Model
 *
 * Defines the data model and validation for PSYPACT eligibility and participation.
 * PSYPACT allows psychologists to practice telepsychology across state lines.
 */

import { z } from 'zod';

// PSYPACT Status values
export type PSYPACTStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'E_PASS' | 'ACTIVE';

// License data for psychology eligibility
export const PsychologyLicenseSchema = z.object({
  state: z.string().length(2),
  licenseNumber: z.string(),
  licenseType: z.string(), // e.g., "Clinical Psychologist", "Licensed Psychologist"
  issueDate: z.string().datetime().or(z.date()),
  expirationDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['active', 'inactive', 'expired', 'revoked']),
  isPrimary: z.boolean().default(false),
});

export type PsychologyLicense = z.infer<typeof PsychologyLicenseSchema>;

// PSYPACT Compact validation schema
export const PSYPACTCompactSchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  participatingStates: z.array(z.string().length(2)).default([]),
  status: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'E_PASS', 'ACTIVE'] as const).default('NOT_ELIGIBLE'),
  ePassportId: z.string().optional(),
  primaryState: z.string().length(2).optional(),
  licenseData: z.array(PsychologyLicenseSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

export type PSYPACTCompactData = z.infer<typeof PSYPACTCompactSchema>;

// PSYPACT participating states (as of 2024)
export const PSYPACT_STATES = [
  'AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'DC', 'GA', 'ID', 'IL', 'IN', 'KS',
  'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC',
  'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'
] as const;

export type PSYPACTState = typeof PSYPACT_STATES[number];

// PSYPACT eligibility requirements
export interface PSYPACTEligibilityRequirements {
  // Must hold an active, unencumbered license in home state
  hasActiveLicense: boolean;
  // Home state must be a PSYPACT member
  homeStateIsPSYPACTMember: boolean;
  // Must have completed required education (doctoral degree)
  hasDoctoralDegree: boolean;
  // Must have passed EPPP (Examination for Professional Practice in Psychology)
  hasPassedEPPP: boolean;
  // No disciplinary actions or restrictions
  noDisciplinaryActions: boolean;
  // Must be licensed for at least 2 years (for some states)
  meetsExperienceRequirement: boolean;
}

export function validatePSYPACTCompact(data: unknown): PSYPACTCompactData {
  return PSYPACTCompactSchema.parse(data);
}

export function isPSYPACTState(state: string): state is PSYPACTState {
  return PSYPACT_STATES.includes(state as PSYPACTState);
}

// E.Passport status values
export enum EPassportStatus {
  NOT_ENROLLED = 'NOT_ENROLLED',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

// APIT (Authority to Practice Interjurisdictional Telepsychology)
export interface APIT {
  state: string;
  issuedDate: Date;
  expirationDate?: Date;
  status: 'active' | 'inactive' | 'expired';
}

// TAP (Temporary Authorization to Practice)
export interface TAP {
  state: string;
  issuedDate: Date;
  expirationDate: Date; // TAPs are always temporary
  daysRemaining: number;
  status: 'active' | 'expired';
}

