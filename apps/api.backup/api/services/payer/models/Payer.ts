/**
 * B137A-PAYER-002: Payer model
 *
 * Stores payer configuration including enrollment endpoints, plan types,
 * and requirements for CAQH and PECOS enrollment.
 */

import { z } from 'zod';

// Contact information structure
export interface PayerContactInfo {
  phone?: string;
  email?: string;
  supportUrl?: string;
  enrollmentGuideUrl?: string;
  portalUrl?: string;
}

// Payer metadata
export interface PayerMetadata {
  processingTimedays?: number; // Typical enrollment processing time
  credentialingRequirements?: string[];
  specialNotes?: string;
  autoEnrollmentAvailable?: boolean;
}

// Validation schema for payer creation
export const CreatePayerSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  name: z.string().min(1, 'Payer name is required'),
  planTypes: z.array(z.string()).min(1, 'At least one plan type is required'),
  enrollmentEndpoint: z.string().url().optional(),
  x12SubmitEndpoint: z.string().url().optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    supportUrl: z.string().url().optional(),
    enrollmentGuideUrl: z.string().url().optional(),
    portalUrl: z.string().url().optional(),
  }).optional(),
  requiresCaqh: z.boolean().default(true),
  requiresPecos: z.boolean().default(false),
  specialty: z.array(z.string()).default([]), // Taxonomy codes
  states: z.array(z.string()).default([]), // Two-letter state codes
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});

export type CreatePayer = z.infer<typeof CreatePayerSchema>;

// Payer record
export interface PayerRecord {
  id: string;
  payerId: string;
  name: string;
  planTypes: string[];
  enrollmentEndpoint: string | null;
  x12SubmitEndpoint: string | null;
  contactInfo: PayerContactInfo | null;
  requiresCaqh: boolean;
  requiresPecos: boolean;
  specialty: string[];
  states: string[];
  metadata: PayerMetadata | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Common US payer IDs
export const COMMON_PAYERS = {
  AETNA: 'AETNA',
  UHC: 'UHC',
  ANTHEM: 'ANTHEM',
  CIGNA: 'CIGNA',
  HUMANA: 'HUMANA',
  BCBS: 'BCBS',
  KAISER: 'KAISER',
  MEDICARE: 'CMS_MEDICARE',
  MEDICAID: 'STATE_MEDICAID',
} as const;

// Plan types
export const PLAN_TYPES = {
  HMO: 'HMO', // Health Maintenance Organization
  PPO: 'PPO', // Preferred Provider Organization
  EPO: 'EPO', // Exclusive Provider Organization
  POS: 'POS', // Point of Service
  HDHP: 'HDHP', // High Deductible Health Plan
  MEDICARE_ADVANTAGE: 'Medicare Advantage',
  MEDICARE_PART_A: 'Medicare Part A',
  MEDICARE_PART_B: 'Medicare Part B',
  MEDICAID: 'Medicaid',
} as const;

// Helper to check if payer supports a specialty
export function supportsSpecialty(payer: PayerRecord, taxonomyCode: string): boolean {
  // Empty specialty array means all specialties supported
  if (payer.specialty.length === 0) return true;
  return payer.specialty.includes(taxonomyCode);
}

// Helper to check if payer operates in a state
export function operatesInState(payer: PayerRecord, stateCode: string): boolean {
  // Empty states array or 'ALL' means nationwide
  if (payer.states.length === 0 || payer.states.includes('ALL')) return true;
  return payer.states.includes(stateCode.toUpperCase());
}

// Helper to filter payers by geography and specialty
export function filterPayersForClinician(
  payers: PayerRecord[],
  options: {
    state?: string;
    specialty?: string;
    planType?: string;
  }
): PayerRecord[] {
  return payers.filter((payer) => {
    if (!payer.isActive) return false;

    if (options.state && !operatesInState(payer, options.state)) {
      return false;
    }

    if (options.specialty && !supportsSpecialty(payer, options.specialty)) {
      return false;
    }

    if (options.planType && !payer.planTypes.includes(options.planType)) {
      return false;
    }

    return true;
  });
}

export function validatePayer(data: unknown): CreatePayer {
  return CreatePayerSchema.parse(data);
}

