/**
 * Wave 196 — MATCHA Storage Layer
 *
 * DB-first with mock-data fallback.
 * Wraps the existing mockData.ts so the engine can stay unchanged.
 */

import { getMockProfile, MOCK_JOBS } from './mockData';
import type { ClinicianProfile } from './matchaModels';
import type { JobPosting } from './eligibility';
import { log } from '../../obs/logger';

const FALLBACK_NPI = '1003000126';

// In-memory override store (keyed by NPI)
const profileOverrides = new Map<string, ClinicianProfile>();

/**
 * Returns the clinician profile for a given NPI.
 * Checks in-memory overrides first, then falls back to mock data.
 * Production: replace with a Prisma query against PersonProfile once DB is migrated.
 */
export function getMatchaProfile(npi?: string): ClinicianProfile {
  if (npi && profileOverrides.has(npi)) {
    return profileOverrides.get(npi)!;
  }
  const lookupNpi = npi ?? FALLBACK_NPI;
  const profile = getMockProfile(lookupNpi);
  if (npi && profile.npi !== npi) {
    log('warn', 'matcha_storage_profile_not_found', { npi, fallback: 'mock_default' });
  }
  return profile;
}

/**
 * Returns all active job postings.
 * Production: query Opportunity model from DB.
 */
export function getJobPostings(): JobPosting[] {
  return MOCK_JOBS;
}

/**
 * Upserts a clinician profile override in-memory.
 * Production: persist to PersonProfile / ClinicianIdentity in DB.
 */
export function upsertMatchaProfile(profile: ClinicianProfile): void {
  profileOverrides.set(profile.npi, profile);
  log('info', 'matcha_storage_profile_upserted', { npi: profile.npi });
}
