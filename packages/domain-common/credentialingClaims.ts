/**
 * CREDENTIALING CLAIMS — Unified Claim Model
 *
 * Every credentialing data point wraps in a CredentialingClaim envelope
 * with standardized: source, evidence, status, confidence, verification_required.
 *
 * This is the bridge between "we have data" and "we can make a credentialing decision."
 *
 * DESIGN RULES:
 * - NO fake integrations — every source must map to a real PSV authority
 * - NO inferred → verified promotion — verification status is immutable once set
 * - Every claim maps to a real NCQA/CMS/Joint Commission credentialing requirement
 */

// ── Claim Type Taxonomy ─────────────────────────────────────────

export const CREDENTIALING_CLAIM_TYPES = [
  'license',
  'board_certification',
  'education',
  'residency',
  'fellowship',
  'work_history',
  'malpractice_history',
  'privileges',
  'dea_registration',
  'npdb_record',
  'identity',
  'sanctions',
  'enrollment',
] as const;

export type CredentialingClaimType = (typeof CREDENTIALING_CLAIM_TYPES)[number];

// ── Claim Status ────────────────────────────────────────────────

export const CLAIM_STATUSES = [
  'verified',
  'self_reported',
  'evidence_backed',
  'expired',
  'revoked',
  'suspended',
  'unknown',
  'not_started',
  'needs_review',
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ── Claim Source ────────────────────────────────────────────────

export const CLAIM_SOURCES = [
  'STATE_BOARD',
  'ABMS',
  'FSMB',
  'NPPES',
  'OIG_LEIE',
  'SAM_EXCLUSIONS',
  'NPDB',
  'DEA',
  'CMS_PECOS',
  'ECFMG',
  'AMA',
  'NCCRS',
  'EMPLOYER',
  'FACILITY',
  'SELF_REPORTED',
  'RESUME_UPLOAD',
  'EVIDENCE_UPLOAD',
] as const;

export type ClaimSource = (typeof CLAIM_SOURCES)[number];

// ── Confidence Levels ───────────────────────────────────────────

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'none'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// ── Evidence ────────────────────────────────────────────────────

export interface ClaimEvidence {
  /** Reference to stored evidence artifact */
  evidenceRef: string;
  /** Type of evidence (document, API response, attestation) */
  evidenceType: 'document' | 'api_response' | 'attestation' | 'receipt';
  /** When the evidence was collected */
  collectedAt: string;
  /** SHA-256 hash of the evidence payload */
  contentHash?: string;
  /** Source URL or API endpoint that produced this evidence */
  sourceUrl?: string;
}

// ── Core Claim Envelope ─────────────────────────────────────────

export interface CredentialingClaim<T = unknown> {
  /** Unique claim identifier */
  claimId: string;
  /** Clinician this claim belongs to */
  clinicianId: string;
  /** What type of credentialing data this is */
  claimType: CredentialingClaimType;
  /** Current verification status */
  status: ClaimStatus;
  /** Where the data came from */
  source: ClaimSource;
  /** Confidence in this claim's accuracy */
  confidence: ConfidenceLevel;
  /** Whether primary source verification is required */
  verificationRequired: boolean;
  /** Supporting evidence artifacts */
  evidence: ClaimEvidence[];
  /** The actual claim data (type-specific payload) */
  payload: T;
  /** When this claim was created */
  createdAt: string;
  /** When this claim was last updated */
  updatedAt: string;
  /** When this claim expires (if applicable) */
  expiresAt?: string;
  /** Human-readable notes */
  notes?: string;
}

// ── Type-Specific Payloads ──────────────────────────────────────

export interface LicenseClaimPayload {
  state: string;
  licenseNumber: string;
  licenseType: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'unknown';
  issueDate?: string;
  expiryDate?: string;
  disciplinaryFlag: boolean;
  restrictions: string[];
}

export interface BoardCertificationClaimPayload {
  boardName: string;
  specialty: string;
  certificationNumber?: string;
  status: 'current' | 'expired' | 'revoked';
  grantedAt?: string;
  expiresAt?: string;
  recertificationDue?: string;
}

export interface EducationClaimPayload {
  institutionName: string;
  degree: string;
  fieldOfStudy: string;
  graduationDate?: string;
  verificationStatus: 'verified' | 'self_reported' | 'evidence_backed';
  /** ECFMG certification for international graduates */
  ecfmgCertified?: boolean;
}

export interface ResidencyClaimPayload {
  programName: string;
  institution: string;
  specialty: string;
  startDate?: string;
  endDate?: string;
  completionStatus: 'completed' | 'in_progress' | 'withdrawn' | 'unknown';
  acgmeAccredited?: boolean;
}

export interface FellowshipClaimPayload {
  programName: string;
  institution: string;
  subspecialty: string;
  startDate?: string;
  endDate?: string;
  completionStatus: 'completed' | 'in_progress' | 'withdrawn' | 'unknown';
}

export interface WorkHistoryClaimPayload {
  employerName: string;
  facilityName?: string;
  position: string;
  department?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  schedule?: 'full-time' | 'part-time' | 'contract' | 'per-diem' | 'locum';
  reasonForLeaving?: string;
}

export interface MalpracticeHistoryClaimPayload {
  /** Whether any malpractice claims exist */
  hasHistory: boolean;
  claims: MalpracticeClaimEntry[];
}

export interface MalpracticeClaimEntry {
  caseId?: string;
  filedDate?: string;
  resolvedDate?: string;
  status: 'open' | 'settled' | 'dismissed' | 'judgment' | 'unknown';
  amount?: number;
  description?: string;
}

export interface NpdbRecordClaimPayload {
  /** Whether NPDB query returned any records */
  hasRecords: boolean;
  queryDate: string;
  records: NpdbRecordEntry[];
}

export interface NpdbRecordEntry {
  reportType: 'medical_malpractice' | 'adverse_action' | 'licensure_action' | 'other';
  reportDate?: string;
  effectiveDate?: string;
  description?: string;
  state?: string;
}

export interface PrivilegesClaimPayload {
  facilityName: string;
  facilityId?: string;
  status: 'active' | 'restricted' | 'revoked' | 'expired' | 'pending' | 'unknown';
  grantedAt?: string;
  expiresAt?: string;
  privilegeScope: string[];
  restrictions: string[];
}

export interface DeaRegistrationClaimPayload {
  registrationNumber: string;
  schedules: string[];
  state?: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  issueDate?: string;
  expiryDate?: string;
}

export interface IdentityClaimPayload {
  npi: string;
  firstName: string;
  lastName: string;
  credentials?: string;
  enumerationType: string;
  taxonomyCodes: string[];
}

export interface SanctionsClaimPayload {
  /** Whether sanctions/exclusions were found */
  sanctioned: boolean;
  source: 'OIG_LEIE' | 'SAM_EXCLUSIONS';
  queryDate: string;
  exclusionDate?: string;
  exclusionType?: string;
  reinstatementDate?: string;
}

export interface EnrollmentClaimPayload {
  programName: string;
  programType: 'PECOS' | 'MEDICAID' | 'COMMERCIAL_PAYER';
  status: 'active' | 'pending' | 'suspended' | 'terminated' | 'expired';
  effectiveDate?: string;
  state?: string;
}

// ── Typed Claim Aliases ─────────────────────────────────────────

export type LicenseClaim = CredentialingClaim<LicenseClaimPayload>;
export type BoardCertificationClaim = CredentialingClaim<BoardCertificationClaimPayload>;
export type EducationClaim = CredentialingClaim<EducationClaimPayload>;
export type ResidencyClaim = CredentialingClaim<ResidencyClaimPayload>;
export type FellowshipClaim = CredentialingClaim<FellowshipClaimPayload>;
export type WorkHistoryClaim = CredentialingClaim<WorkHistoryClaimPayload>;
export type MalpracticeHistoryClaim = CredentialingClaim<MalpracticeHistoryClaimPayload>;
export type NpdbRecordClaim = CredentialingClaim<NpdbRecordClaimPayload>;
export type PrivilegesClaim = CredentialingClaim<PrivilegesClaimPayload>;
export type DeaRegistrationClaim = CredentialingClaim<DeaRegistrationClaimPayload>;
export type IdentityClaim = CredentialingClaim<IdentityClaimPayload>;
export type SanctionsClaim = CredentialingClaim<SanctionsClaimPayload>;
export type EnrollmentClaim = CredentialingClaim<EnrollmentClaimPayload>;

// ── Clinician Credentialing Profile ─────────────────────────────

export interface ClinicianCredentialingProfile {
  clinicianId: string;
  identity: IdentityClaim | null;
  licenses: LicenseClaim[];
  boardCertifications: BoardCertificationClaim[];
  education: EducationClaim[];
  residencies: ResidencyClaim[];
  fellowships: FellowshipClaim[];
  workHistory: WorkHistoryClaim[];
  malpracticeHistory: MalpracticeHistoryClaim | null;
  npdbRecords: NpdbRecordClaim | null;
  sanctions: SanctionsClaim[];
  privileges: PrivilegesClaim[];
  deaRegistrations: DeaRegistrationClaim[];
  enrollments: EnrollmentClaim[];
  updatedAt: string;
}
