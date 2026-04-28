/**
 * Clinician profile foundation types.
 *
 * Layered on top of the existing `lib/profile/provenance.ts` 5-tier
 * vocabulary (VERIFIED / USER_ENTERED / INFERRED / UNKNOWN / CONFLICT).
 * Adds a confidence axis so the foundation can distinguish:
 *   - source-backed (a real source-of-record check has run)
 *   - self-attested (the clinician typed it; PSV not run)
 *   - imported-candidate (came in via an import path; not source-backed yet)
 *   - unverified (default for unknown/conflict/missing)
 *
 * Truth rules baked into the type model:
 *   - Every profile field carries provenance + confidence.
 *   - User-entered values are NEVER `verified`.
 *   - Imported candidates (PubMed, LinkedIn, Doximity) stay
 *     `imported-candidate` until a source-backed check upgrades them.
 *   - Unknown/conflict fields never count toward verified completion.
 */

import type { ProfileField, ProfileProvenance } from '@/lib/profile/provenance';

export type { ProfileProvenance };

export type ProfileFieldProvenance = ProfileProvenance;

export type ProfileFieldConfidence =
  | 'source-backed'
  | 'self-attested'
  | 'imported-candidate'
  | 'unverified';

export interface ProfileFieldMeta<T> extends ProfileField<T> {
  confidence: ProfileFieldConfidence;
}

export type ProfileSectionKey =
  | 'identity'
  | 'medical_school'
  | 'residency'
  | 'fellowship'
  | 'training_programs'
  | 'specialties'
  | 'current_employer'
  | 'employer_history'
  | 'affiliations'
  | 'research'
  | 'publications'
  | 'career_goals';

export interface ProfileCompletionSignal {
  section: ProfileSectionKey;
  filledFieldCount: number;
  totalFieldCount: number;
  sourceBackedFieldCount: number;
  unresolvedConflictCount: number;
  /** 0..1 — does NOT imply verification, only "filled-ness". */
  filledRatio: number;
  /** 0..1 — the share of filled fields that are source-backed. */
  sourceBackedRatio: number;
  /** Reason text for the UI; never claims verification. */
  readinessNote: string;
}

export interface ClinicianIdentitySection {
  legalName: ProfileFieldMeta<string | null>;
  preferredName: ProfileFieldMeta<string | null>;
  npi: ProfileFieldMeta<string | null>;
  primaryEmail: ProfileFieldMeta<string | null>;
  primaryPhone: ProfileFieldMeta<string | null>;
  practiceLocations: ProfileFieldMeta<string[] | null>;
}

export interface ClinicianEducationEntry {
  id: string;
  institution: ProfileFieldMeta<string | null>;
  degree: ProfileFieldMeta<string | null>;
  graduationYear: ProfileFieldMeta<number | null>;
  /** Marks the entry as a degree-bearing program (medical school, etc.). */
  programType: 'medical_school' | 'undergraduate' | 'graduate' | 'other';
}

export interface ClinicianTrainingEntry {
  id: string;
  programType: 'residency' | 'fellowship' | 'internship' | 'other_training';
  institution: ProfileFieldMeta<string | null>;
  specialty: ProfileFieldMeta<string | null>;
  startYear: ProfileFieldMeta<number | null>;
  endYear: ProfileFieldMeta<number | null>;
}

export interface ClinicianEmploymentEntry {
  id: string;
  employer: ProfileFieldMeta<string | null>;
  title: ProfileFieldMeta<string | null>;
  startDate: ProfileFieldMeta<string | null>;
  endDate: ProfileFieldMeta<string | null>;
  isCurrent: boolean;
}

export interface ClinicianAffiliationEntry {
  id: string;
  organization: ProfileFieldMeta<string | null>;
  affiliationType: ProfileFieldMeta<string | null>;
  startDate: ProfileFieldMeta<string | null>;
  endDate: ProfileFieldMeta<string | null>;
}

export interface ClinicianResearchEntry {
  id: string;
  topic: ProfileFieldMeta<string | null>;
  role: ProfileFieldMeta<string | null>;
  institution: ProfileFieldMeta<string | null>;
}

export interface ClinicianPublicationEntry {
  id: string;
  title: ProfileFieldMeta<string | null>;
  journal: ProfileFieldMeta<string | null>;
  publishedYear: ProfileFieldMeta<number | null>;
  pubmedId: ProfileFieldMeta<string | null>;
  /** Imported via a third-party path (PubMed/LinkedIn/Doximity)? */
  importSource: 'pubmed' | 'linkedin' | 'doximity' | null;
}

export interface ClinicianSpecialtyEntry {
  id: string;
  specialty: ProfileFieldMeta<string | null>;
  subspecialty: ProfileFieldMeta<string | null>;
  boardCertified: ProfileFieldMeta<boolean | null>;
}

export interface ClinicianProfile {
  clinicianId: string;
  identity: ClinicianIdentitySection;
  education: ClinicianEducationEntry[];
  training: ClinicianTrainingEntry[];
  specialties: ClinicianSpecialtyEntry[];
  currentEmployer: ClinicianEmploymentEntry | null;
  employerHistory: ClinicianEmploymentEntry[];
  affiliations: ClinicianAffiliationEntry[];
  research: ClinicianResearchEntry[];
  publications: ClinicianPublicationEntry[];
  careerGoals: ProfileFieldMeta<string | null>;
}

/**
 * Truth invariants enforced by the model:
 *   1. A field's confidence must NEVER be `source-backed` if its
 *      provenance is `USER_ENTERED`. Helpers that build profiles
 *      should reject this combination.
 *   2. `imported-candidate` is the default for fields originating
 *      from PubMed/LinkedIn/Doximity until a source check upgrades.
 *   3. `unverified` is the default for `UNKNOWN` and `CONFLICT`.
 */
export function isCoherentProvenance(
  provenance: ProfileFieldProvenance,
  confidence: ProfileFieldConfidence,
): boolean {
  if (provenance === 'USER_ENTERED' && confidence === 'source-backed') return false;
  if (provenance === 'UNKNOWN' && confidence !== 'unverified') return false;
  if (provenance === 'CONFLICT' && confidence === 'source-backed') return false;
  return true;
}
