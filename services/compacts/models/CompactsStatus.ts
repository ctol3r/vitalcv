/**
 * B138A-COMPACT-008: Unified CompactsStatus Model
 *
 * Defines the unified data model for all compact eligibility statuses.
 * This model aggregates IMLC, PSYPACT, and Counseling Compact eligibility.
 */

import { z } from 'zod';
import type { IMLCStatus } from './IMLCEligibility.js';
import type { PSYPACTStatus } from './Psycompact.js';
import type { CounselingCompactStatus } from './CounselingCompact.js';

// Unified Compacts Status validation schema
export const CompactsStatusSchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  // IMLC fields
  imlcStatus: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'LICENSED'] as const).default('NOT_ELIGIBLE'),
  imlcHomeState: z.string().length(2).optional(),
  imlcCompactStates: z.array(z.string().length(2)).default([]),
  // PSYPACT fields
  psypactStatus: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'E_PASS', 'ACTIVE'] as const).default('NOT_ELIGIBLE'),
  psypactStates: z.array(z.string().length(2)).default([]),
  // Counseling Compact fields
  counselingStatus: z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'ACTIVE'] as const).default('NOT_ELIGIBLE'),
  counselingHomeState: z.string().length(2).optional(),
  counselingStates: z.array(z.string().length(2)).default([]),
  // Metadata
  lastComputedAt: z.string().datetime().or(z.date()).optional(),
  nextRefreshAt: z.string().datetime().or(z.date()).optional(),
  vcHash: z.string().optional(),
  vcCredentialId: z.string().optional(),
  anchoredTxHash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CompactsStatusData = z.infer<typeof CompactsStatusSchema>;

// Full compacts status with all details
export interface FullCompactsStatus {
  clinicianDid: string;
  imlc: {
    status: IMLCStatus;
    homeState?: string;
    compactStates: string[];
    lastCheckedAt: Date;
  };
  psypact: {
    status: PSYPACTStatus;
    participatingStates: string[];
    ePassportId?: string;
    primaryState?: string;
    lastCheckedAt: Date;
  };
  counseling: {
    status: CounselingCompactStatus;
    homeState?: string;
    compactStates: string[];
    lastCheckedAt: Date;
  };
  unified: {
    lastComputedAt: Date;
    nextRefreshAt?: Date;
    vcHash?: string;
    vcCredentialId?: string;
    anchoredTxHash?: string;
  };
}

// Summary of compact eligibility
export interface CompactsEligibilitySummary {
  clinicianDid: string;
  hasAnyCompactEligibility: boolean;
  imlcEligible: boolean;
  psypactEligible: boolean;
  counselingEligible: boolean;
  totalEligibleStates: string[]; // Union of all compact states
  compactTypes: string[]; // List of compact types the clinician is eligible for
}

export function validateCompactsStatus(data: unknown): CompactsStatusData {
  return CompactsStatusSchema.parse(data);
}

// Helper function to compute eligibility summary
export function computeEligibilitySummary(status: CompactsStatusData): CompactsEligibilitySummary {
  const imlcEligible = status.imlcStatus === 'ELIGIBLE' || status.imlcStatus === 'LICENSED';
  const psypactEligible = status.psypactStatus !== 'NOT_ELIGIBLE';
  const counselingEligible = status.counselingStatus !== 'NOT_ELIGIBLE';

  const allStates = new Set([
    ...(imlcEligible ? status.imlcCompactStates : []),
    ...(psypactEligible ? status.psypactStates : []),
    ...(counselingEligible ? status.counselingStates : []),
  ]);

  const compactTypes: string[] = [];
  if (imlcEligible) compactTypes.push('IMLC');
  if (psypactEligible) compactTypes.push('PSYPACT');
  if (counselingEligible) compactTypes.push('CounselingCompact');

  return {
    clinicianDid: status.clinicianDid,
    hasAnyCompactEligibility: imlcEligible || psypactEligible || counselingEligible,
    imlcEligible,
    psypactEligible,
    counselingEligible,
    totalEligibleStates: Array.from(allStates),
    compactTypes,
  };
}

// Cache TTL for compacts status (24 hours)
export const COMPACTS_STATUS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isRefreshNeeded(status: CompactsStatusData): boolean {
  if (!status.nextRefreshAt) return true;
  const nextRefresh = typeof status.nextRefreshAt === 'string'
    ? new Date(status.nextRefreshAt)
    : status.nextRefreshAt;
  return new Date() >= nextRefresh;
}

