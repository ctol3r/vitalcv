import type {
  CandidateCredential,
  ClinicianIdentity,
  IngestConflictRecord,
  IngestConflictType,
  LicenseCandidate,
  VerificationStatus,
} from '../../ingest/models';

export type CredentialCandidate = CandidateCredential;

export type EducationCandidate = Readonly<{
  value: string;
  source: 'resume_upload' | 'npi';
  status: VerificationStatus;
}>;

export type EmploymentCandidate = Readonly<{
  value: string;
  source: 'resume_upload';
  status: VerificationStatus;
}>;

export type {
  ClinicianIdentity,
  IngestConflictRecord,
  IngestConflictType,
  LicenseCandidate,
  VerificationStatus,
};
