export type VerificationStatus = 'UNVERIFIED';

export type PracticeLocation = Readonly<{
  address_1: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
}>;

export type LicenseCandidate = Readonly<{
  state: string;
  number?: string;
  source: 'resume' | 'npi';
  status: VerificationStatus;
}>;

/**
 * Provenance of an education or training record. `inferred` records were
 * not literally extracted from a source document — they were synthesised
 * by a deterministic rule (e.g. PA-C credential implies an accredited
 * PA program). The UI must surface inferred records as such.
 */
export type EducationTrainingProvenance = 'extracted' | 'inferred' | 'verified';

/**
 * A single education record for a provider. Mirrors the `education` table:
 *   provider_id, institution, degree, year, confidence
 *
 * `confidence` is a 0..1 score (not 0..100) so it composes cleanly with
 * other probabilistic signals in the data-confidence engine. The display
 * layer scales it to a percentage for the UI.
 */
export type EducationRecord = Readonly<{
  provider_id: string;
  institution: string;
  degree: string;
  year?: number;
  confidence: number;
  provenance: EducationTrainingProvenance;
}>;

/**
 * A single training record for a provider. Mirrors the `training` table:
 *   provider_id, program, specialty, year, confidence
 *
 * Used for residencies, fellowships, accredited PA programs, etc.
 */
export type TrainingRecord = Readonly<{
  provider_id: string;
  program: string;
  specialty?: string;
  year?: number;
  confidence: number;
  provenance: EducationTrainingProvenance;
}>;

export type ClinicianIdentity = Readonly<{
  clinician_id: string;
  npi: string;
  first_name: string;
  last_name: string;
  enumeration_type: string;
  taxonomy: readonly string[];
  practice_locations: readonly PracticeLocation[];
  licenses: readonly LicenseCandidate[];
  status: VerificationStatus;
  source: 'NPPES';
  fetched_at: string;
}>;

export type CandidateCredential = Readonly<{
  candidate_credential_id: string;
  clinician_id: string;
  source: 'resume_upload';
  status: VerificationStatus;
  filename: string;
  mime_type: string;
  extracted_at: string;
  name_hint?: string;
  education: readonly string[];
  training: readonly string[];
  licensure_mentions: readonly string[];
  licenses: readonly LicenseCandidate[];
  employment_timeline: readonly string[];
  pre_psv_confidence_score: number;
  fields_found: readonly string[];
  fields_missing: readonly string[];
}>;

export type CandidateCredentialParseSummary = Readonly<{
  fields_found: readonly string[];
  fields_missing: readonly string[];
}>;

export type IngestConflictType =
  | 'NAME_MISMATCH'
  | 'STATE_LICENSE_MISMATCH'
  | 'SPECIALTY_MISMATCH';

export type IngestConflictRecord = Readonly<{
  conflict_id: string;
  clinician_id: string;
  conflict_type: IngestConflictType;
  sources: Readonly<{
    left: 'NPI';
    right: 'RESUME';
  }>;
  values: Readonly<{
    npi: unknown;
    resume: unknown;
  }>;
  status: 'UNRESOLVED';
  detected_at: string;
}>;
