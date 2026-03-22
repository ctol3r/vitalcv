/**
 * contracts.ts — Canonical typed contracts for the VCV domain model
 *
 * This file defines the app-layer TypeScript types that mirror the
 * Prisma schema additions from Waves S1/S4/S5. These types are used
 * by services, routes, and tests — NOT for Prisma ORM calls (use
 * the generated Prisma client for those).
 *
 * Types here reference the enums defined in types.ts where appropriate.
 */

import type { VcvVerificationLevel as PrismaVcvVerificationLevel } from '@prisma/client';

// Re-export for convenience
export type { VcvCredentialDomain, VcvVerificationLevel, VcvOrgContextType, VcvOrgContextStatus }
  from '@prisma/client';

// ── Credential domain contracts ───────────────────────────────────────────────

/**
 * Canonical credential domain codes with human-readable labels.
 * Order reflects a typical credentialing workflow sequence.
 */
export const CREDENTIAL_DOMAIN_LABELS: Record<string, string> = {
  IDENTITY:             'Identity Verification',
  LICENSURE:            'State License',
  BOARD_CERTIFICATION:  'Board Certification',
  DEA_REGISTRATION:     'DEA Registration',
  MEDICARE_ENROLLMENT:  'Medicare Enrollment',
  EXCLUSION_CHECK:      'Exclusion / Debarment Check',
  HOSPITAL_PRIVILEGE:   'Hospital Privileges',
  MALPRACTICE:          'Malpractice Insurance',
  EDUCATION:            'Education',
  TRAINING:             'Training / Residency',
  EMPLOYMENT:           'Employment / Affiliation',
} as const;

/** Domains that produce a blocking result if missing for a clinician */
export const BLOCKING_CREDENTIAL_DOMAINS = [
  'IDENTITY',
  'LICENSURE',
  'EXCLUSION_CHECK',
] as const;

/** Domains that have freshness windows requiring periodic reverification */
export const FRESHNESS_WINDOWS_DAYS: Partial<Record<string, number>> = {
  LICENSURE:            90,   // NCQA: 90-day reverification window
  BOARD_CERTIFICATION:  180,  // NCQA: 180-day window for board certs
  DEA_REGISTRATION:     120,  // DEA registrations: 120-day window
  MEDICARE_ENROLLMENT:  180,  // PECOS: 180-day window
  EXCLUSION_CHECK:      90,   // OIG/LEIE: 90-day window
  MALPRACTICE:          90,   // Malpractice: 90-day window
  HOSPITAL_PRIVILEGE:   180,  // Privilege review: 180-day window
} as const;

// ── VcvCredential app-layer types ─────────────────────────────────────────────

export interface CredentialClaimValue {
  // Licensure
  licenseNumber?:   string;
  licenseState?:    string;
  licenseStatus?:   'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
  // Board Certification
  boardName?:       string;
  certNumber?:      string;
  specialty?:       string;
  subspecialty?:    string;
  // DEA
  deaNumber?:       string;
  deaSchedules?:    string[];
  // PECOS
  pecosStatus?:     'ENROLLED' | 'NOT_ENROLLED' | 'OPT_OUT';
  // Exclusion
  excluded?:        boolean;
  exclusionBasis?:  string;
  // Common
  issuingAuthority?: string;
  rawSourceData?:   unknown;
}

export interface CredentialSummary {
  id:               string;
  domain:           string;
  credentialType:   string;
  status:           string;
  verificationLevel: PrismaVcvVerificationLevel;
  jurisdiction?:    string;
  issuedAt?:        string;
  expiresAt?:       string;
  verifiedAt?:      string;
  daysUntilExpiry?: number;
  isStale?:         boolean;
  issuerName?:      string;
}

/**
 * Compute stale status for a credential given its domain freshness window.
 */
export function isCredentialStale(
  credential: { domain: string; verifiedAt?: string | Date | null },
): boolean {
  const window = FRESHNESS_WINDOWS_DAYS[credential.domain];
  if (!window || !credential.verifiedAt) return false;
  const verifiedMs = new Date(credential.verifiedAt).getTime();
  const windowMs   = window * 24 * 60 * 60 * 1000;
  return Date.now() - verifiedMs > windowMs;
}

/**
 * Compute days until expiry (negative = already expired).
 */
export function daysUntilExpiry(expiresAt: string | Date | null | undefined): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

// ── Education record contracts ─────────────────────────────────────────────────

export const EDUCATION_RECORD_TYPES = [
  'MEDICAL_DEGREE',
  'NURSING_DEGREE',
  'ADVANCED_PRACTICE_CERT',
  'RESIDENCY_COMPLETION',
  'FELLOWSHIP_COMPLETION',
  'INTERNSHIP_COMPLETION',
  'CME_COMPLETION',
  'TRAINING_PROGRAM_STATUS',
  'CLINICAL_ROTATION',
] as const;

export type EducationRecordType = typeof EDUCATION_RECORD_TYPES[number];

export const EDUCATION_RECORD_LABELS: Record<EducationRecordType, string> = {
  MEDICAL_DEGREE:           'Medical Degree',
  NURSING_DEGREE:           'Nursing Degree',
  ADVANCED_PRACTICE_CERT:   'Advanced Practice Certificate',
  RESIDENCY_COMPLETION:     'Residency',
  FELLOWSHIP_COMPLETION:    'Fellowship',
  INTERNSHIP_COMPLETION:    'Internship',
  CME_COMPLETION:           'Continuing Medical Education',
  TRAINING_PROGRAM_STATUS:  'Training Program (Active)',
  CLINICAL_ROTATION:        'Clinical Rotation',
};

/** Education record types that are permanent once completed (no freshness window) */
export const PERMANENT_EDUCATION_TYPES: EducationRecordType[] = [
  'MEDICAL_DEGREE',
  'NURSING_DEGREE',
  'ADVANCED_PRACTICE_CERT',
  'RESIDENCY_COMPLETION',
  'FELLOWSHIP_COMPLETION',
  'INTERNSHIP_COMPLETION',
];

/** Education record types that affect credential readiness when missing */
export const READINESS_BLOCKING_EDUCATION: EducationRecordType[] = [
  'MEDICAL_DEGREE',
];

/** Freshness windows for non-permanent education types (days) */
export const EDUCATION_FRESHNESS_WINDOWS: Partial<Record<EducationRecordType, number>> = {
  TRAINING_PROGRAM_STATUS: 90,
  CME_COMPLETION:          365,
};

export interface EducationReadinessContribution {
  recordType:      EducationRecordType;
  present:         boolean;
  verified:        boolean;
  blocking:        boolean;
  stale:           boolean;
  gapMessage?:     string;
}

/**
 * Evaluate education records for readiness contribution.
 */
export function evaluateEducationReadiness(
  records: Array<{ recordType: string; completed: boolean; verificationLevel: string; updatedAt?: Date | string }>,
): EducationReadinessContribution[] {
  return READINESS_BLOCKING_EDUCATION.map(recordType => {
    const found = records.find(r => r.recordType === recordType);
    const present  = !!found;
    const verified = !!found && (
      found.verificationLevel === 'SOURCE_VERIFIED' ||
      found.verificationLevel === 'CRYPTOGRAPHICALLY_SIGNED'
    );
    const freshWindow = EDUCATION_FRESHNESS_WINDOWS[recordType];
    const stale = !!(found && freshWindow && found.updatedAt &&
      Date.now() - new Date(found.updatedAt).getTime() > freshWindow * 24 * 60 * 60 * 1000);
    const blocking = READINESS_BLOCKING_EDUCATION.includes(recordType);

    return {
      recordType,
      present,
      verified,
      blocking,
      stale,
      gapMessage: !present && blocking
        ? `${EDUCATION_RECORD_LABELS[recordType]} is required but not on file.`
        : stale
          ? `${EDUCATION_RECORD_LABELS[recordType]} record may be outdated.`
          : undefined,
    };
  });
}

// ── Organization context contracts ────────────────────────────────────────────

export const ORG_CONTEXT_TYPE_LABELS: Record<string, string> = {
  APPLICATION:         'Job Application',
  EMPLOYMENT_REVIEW:   'Employment Credentialing Review',
  PRIVILEGING:         'Hospital Privileges Request',
  CREDENTIALING:       'Initial Credentialing',
  RECREDENTIALING:     'Re-credentialing',
  TRAINING_ENROLLMENT: 'Training Program Enrollment',
  ISSUER_REVIEW:       'Issuer Credential Review',
  MONITORING:          'Ongoing Monitoring',
  COMPLIANCE_AUDIT:    'Compliance / Accreditation Audit',
} as const;

export const ORG_CONTEXT_STATUS_LABELS: Record<string, string> = {
  PENDING:   'Awaiting Response',
  ACTIVE:    'In Review',
  COMPLETED: 'Completed',
  EXPIRED:   'Expired',
  REVOKED:   'Revoked',
} as const;

export const ORG_CONTEXT_SUBJECT_STATUS_LABELS: Record<string, string> = {
  PENDING:       'Invited',
  SUBMITTED:     'Submitted',
  UNDER_REVIEW:  'Under Review',
  APPROVED:      'Approved',
  DENIED:        'Denied',
  WITHDRAWN:     'Withdrawn',
} as const;

/**
 * Credential domains required for each context type.
 * Used to auto-generate gap analysis when a context is created.
 */
export const CONTEXT_REQUIRED_DOMAINS: Record<string, string[]> = {
  APPLICATION:         ['IDENTITY', 'LICENSURE', 'EXCLUSION_CHECK'],
  EMPLOYMENT_REVIEW:   ['IDENTITY', 'LICENSURE', 'EXCLUSION_CHECK', 'MALPRACTICE'],
  PRIVILEGING:         ['IDENTITY', 'LICENSURE', 'BOARD_CERTIFICATION', 'EXCLUSION_CHECK', 'MALPRACTICE'],
  CREDENTIALING:       ['IDENTITY', 'LICENSURE', 'BOARD_CERTIFICATION', 'DEA_REGISTRATION', 'EXCLUSION_CHECK', 'MEDICARE_ENROLLMENT'],
  RECREDENTIALING:     ['IDENTITY', 'LICENSURE', 'BOARD_CERTIFICATION', 'EXCLUSION_CHECK'],
  TRAINING_ENROLLMENT: ['IDENTITY', 'EDUCATION'],
  ISSUER_REVIEW:       ['IDENTITY', 'LICENSURE', 'EDUCATION'],
  MONITORING:          ['LICENSURE', 'EXCLUSION_CHECK'],
  COMPLIANCE_AUDIT:    ['IDENTITY', 'LICENSURE', 'EXCLUSION_CHECK', 'MALPRACTICE'],
} as const;

export interface OrgContextSummary {
  id:          string;
  contextType: string;
  typeLabel:   string;
  status:      string;
  statusLabel: string;
  requestorName: string;
  subjectCount:  number;
  dueAt?:      string;
  completedAt?: string;
  createdAt:   string;
}

// ── User entity claim contracts ───────────────────────────────────────────────

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  SUBJECT:     'Identity Subject',
  COORDINATOR: 'Credentialing Coordinator',
  EMPLOYER:    'Employer / Reviewer',
  AUDITOR:     'Compliance Auditor',
} as const;

export const VERIFICATION_LEVEL_LABELS: Record<PrismaVcvVerificationLevel, string> = {
  SELF_REPORTED:           'Self-reported',
  SOURCE_MATCHED:          'Source-matched',
  SOURCE_VERIFIED:         'Source-verified',
  CRYPTOGRAPHICALLY_SIGNED:'Cryptographically signed',
  BIOMETRICALLY_CONFIRMED: 'Biometrically confirmed',
} as const;

export const VERIFICATION_LEVEL_STRENGTH: Record<PrismaVcvVerificationLevel, number> = {
  SELF_REPORTED:           0,
  SOURCE_MATCHED:          1,
  SOURCE_VERIFIED:         2,
  CRYPTOGRAPHICALLY_SIGNED:3,
  BIOMETRICALLY_CONFIRMED: 4,
} as const;

/**
 * Returns true if `actual` meets or exceeds the `required` verification level.
 */
export function meetsVerificationLevel(
  actual:   PrismaVcvVerificationLevel,
  required: PrismaVcvVerificationLevel,
): boolean {
  return VERIFICATION_LEVEL_STRENGTH[actual] >= VERIFICATION_LEVEL_STRENGTH[required];
}

// ── NPI routing contracts (S3) ────────────────────────────────────────────────

export type NpiRoutingDecision = {
  npi:            string;
  entityType:     'person' | 'organization';
  primaryRoles:   string[];
  workflowEntry:  '/get-ready' | '/employers' | '/verifier';
  subjectLabel:   string;
  routingSource:  'NPI_TYPE' | 'NPPES_API' | 'CACHED_ENTITY' | 'DEFAULT';
  confidence:     'HIGH' | 'MEDIUM' | 'LOW';
  warning?:       string;   // e.g. "NPI type unavailable — defaulted to person"
};

/**
 * Make a routing decision from a resolved NPI type string.
 * Source of truth for UI routing and API branching.
 */
export function makeNpiRoutingDecision(
  npi:           string,
  enumerationType: string | undefined,
  source: NpiRoutingDecision['routingSource'] = 'NPPES_API',
): NpiRoutingDecision {
  const isOrg    = enumerationType === 'NPI-2';
  const isKnown  = enumerationType === 'NPI-1' || enumerationType === 'NPI-2';

  return {
    npi,
    entityType:    isOrg ? 'organization' : 'person',
    primaryRoles:  isOrg ? ['employer', 'verifier'] : ['clinician'],
    workflowEntry: isOrg ? '/employers' : '/get-ready',
    subjectLabel:  isOrg ? 'Organization / Group Practice' : 'Individual Provider',
    routingSource: isKnown ? source : 'DEFAULT',
    confidence:    isKnown ? 'HIGH' : 'LOW',
    warning:       !isKnown
      ? 'NPI enumeration type unavailable — defaulted to individual provider routing.'
      : undefined,
  };
}
