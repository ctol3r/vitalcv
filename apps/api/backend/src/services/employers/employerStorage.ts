/**
 * Wave 196 — Employer Storage Layer
 *
 * DB-first with seed-data fallback.
 * Wraps EMPLOYER_KNOWLEDGE_SEEDS so callers get a consistent interface
 * regardless of whether the DB has been seeded.
 *
 * Production: replace in-memory with Prisma OrganizationProfile queries
 * once DB is migrated (wave196 migration adds organization_profiles table).
 */

import { log } from '../../obs/logger';
import {
  type EmployerSeedRecord,
  EMPLOYER_KNOWLEDGE_SEEDS,
  getEmployerSeedBySlug,
  listEmployerSeeds,
} from './employerCatalog';

// In-memory overrides (slug → record)
const employerOverrides = new Map<string, EmployerSeedRecord>();
let seeded = false;

/**
 * Returns all employers.
 * Merges seed data with any runtime overrides.
 */
export function getEmployers(): EmployerSeedRecord[] {
  const base = listEmployerSeeds();
  if (employerOverrides.size === 0) return base;

  const overrideSet = new Set(employerOverrides.keys());
  const merged = base.map((e) =>
    overrideSet.has(e.slug) ? employerOverrides.get(e.slug)! : e,
  );
  return merged;
}

/**
 * Returns a single employer by slug, or undefined if not found.
 */
export function getEmployerBySlug(slug: string): EmployerSeedRecord | undefined {
  if (employerOverrides.has(slug)) {
    return employerOverrides.get(slug);
  }
  return getEmployerSeedBySlug(slug);
}

/**
 * Seeds the in-memory store from EMPLOYER_KNOWLEDGE_SEEDS if not already done.
 * Production: use this to trigger a DB upsert of all seeds on startup.
 */
export function seedEmployersIfEmpty(): void {
  if (seeded) return;
  seeded = true;
  log('info', 'employer_storage_seeded', { count: EMPLOYER_KNOWLEDGE_SEEDS.length });
}

/**
 * Upserts an employer record (in-memory).
 * Production: persist to OrganizationProfile in DB.
 */
export function upsertEmployer(record: EmployerSeedRecord): void {
  employerOverrides.set(record.slug, record);
  log('info', 'employer_storage_upserted', { slug: record.slug });
}
