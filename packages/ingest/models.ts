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
