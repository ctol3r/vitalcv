/**
 * B196B-CONTRACT-008
 * Credentialing domain contracts to standardize PSV, licensing, and payer artifacts.
 */

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export const LICENSE_STATUS_VALUES = ['active', 'inactive', 'expired', 'suspended', 'revoked', 'probation'] as const;
export type LicenseStatus = (typeof LICENSE_STATUS_VALUES)[number];

export const LICENSE_VERIFICATION_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED'] as const;
export type LicenseVerificationStatus = (typeof LICENSE_VERIFICATION_STATUS_VALUES)[number];

export interface LicenseVerificationRecord {
  id: string;
  clinicianId: string;
  state: string;
  licenseNumber: string;
  status: LicenseVerificationStatus;
  issueDate?: string;
  expiryDate?: string;
  disciplinaryFlag?: boolean;
  restrictions?: JsonValue;
  disciplinaryHistory?: JsonValue;
  sourceMetadata?: JsonValue;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardCertificationRecord {
  id: string;
  clinicianId: string;
  boardName: string;
  specialty: string;
  certificationNumber?: string;
  grantedAt?: string;
  expiresAt?: string;
  status: 'CURRENT' | 'EXPIRED' | 'REVOKED';
  verificationSource?: string;
}

export interface DeaRegistrationRecord {
  id: string;
  clinicianId: string;
  registrationNumber: string;
  schedules: string[];
  state?: string;
  issuedAt?: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  linkedLicenseId?: string;
  metadata?: JsonValue;
}

export interface PecosEnrollmentRecord {
  id: string;
  clinicianId: string;
  orgId: string;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED' | 'EXPIRED';
  effectiveDate?: string;
  lastSyncedAt?: string;
  metadata?: JsonValue;
}

export interface MedicaidEnrollmentRecord {
  id: string;
  clinicianId: string;
  state: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'TERMINATED';
  effectiveDate?: string;
  lastSyncedAt?: string;
  programs?: string[];
  metadata?: JsonValue;
}

export const PAYER_ENROLLMENT_STATUS_VALUES = ['PENDING', 'ATTEMPTING', 'ENROLLED', 'PANEL_FULL', 'REJECTED', 'REVALIDATION_DUE'] as const;
export type PayerEnrollmentStatus = (typeof PAYER_ENROLLMENT_STATUS_VALUES)[number];

export interface PayerEnrollmentRecord {
  id: string;
  clinicianId: string;
  payerId: string;
  payerName: string;
  status: PayerEnrollmentStatus;
  effectiveDate?: string;
  expiresAt?: string;
  requiresPecos?: boolean;
  requiresMedicaid?: boolean;
  conflictsWith?: string[];
  lastUpdatedAt: string;
  metadata?: JsonValue;
}

// ---------------------------------------------------------------------------
// Evidence bundle contracts
// ---------------------------------------------------------------------------

export interface LicenseCheckEvidence {
  checkId: string;
  npi: string;
  state: string;
  licenseNumber: string;
  status: LicenseVerificationStatus | string;
  sourceUrl: string;
  checkedAt: string;
}

export interface SanctionsCheckEvidence {
  checkId: string;
  npi: string;
  sanctioned: boolean;
  sourceUrl: string;
  checkedAt: string;
}

export interface EvidenceBundleManifest {
  bundleId: string;
  clinicianId: string;
  npi?: string;
  vcId?: string;
  psvResultId: string;
  timestamp: string;
  results: {
    licenseCheck: LicenseCheckEvidence;
    sanctionsCheck: SanctionsCheckEvidence;
  };
  overallStatus: string;
  sourceUrls: string[];
  metadata?: JsonObject;
}

export interface EvidenceBundleResult {
  bundleId: string;
  manifestPath: string;
  tempDirectory: string;
  manifest: EvidenceBundleManifest;
}


