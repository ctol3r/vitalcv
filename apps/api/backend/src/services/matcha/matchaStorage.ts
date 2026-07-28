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

// In-memory override store (keyed by NPI)
const profileOverrides = new Map<string, ClinicianProfile>();

/** Thrown when no profile exists for the requested NPI. */
export class MatchaProfileNotFoundError extends Error {
  readonly npi: string;

  constructor(npi: string) {
    super(`No MATCHA profile for NPI ${npi}`);
    this.name = 'MatchaProfileNotFoundError';
    this.npi = npi;
  }
}

/**
 * Returns the clinician profile for a given NPI.
 * Checks in-memory overrides first, then demo data.
 * Production: replace with a Prisma query against PersonProfile once DB is migrated.
 *
 * `npi` is required and an unknown NPI throws. Until 2026-07-27 the signature was
 * `getMatchaProfile(npi?: string)` over a `FALLBACK_NPI` of '1003000126', so a
 * caller that lost its NPI silently received the profile of a real physician.
 * Absent input is a caller bug and an unknown NPI is a not-found; neither is a
 * licence to answer with somebody else's identity. Throwing rather than returning
 * null keeps that impossible to swallow with a `??` or a `!`.
 */
export function getMatchaProfile(npi: string): ClinicianProfile {
  const override = profileOverrides.get(npi);
  if (override) {
    return override;
  }

  const profile = getMockProfile(npi);
  if (!profile) {
    log('warn', 'matcha_storage_profile_not_found', { npi });
    throw new MatchaProfileNotFoundError(npi);
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
