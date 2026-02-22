import type { ClaimLevel } from '@/components/trust-state/types';

/* ------------------------------------------------------------------ */
/*  Credential record — rows in the issuer's registry                  */
/* ------------------------------------------------------------------ */

export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING';

export interface CredentialRecord {
  id: string;
  credentialType: string;
  subjectName: string;
  subjectNpi: string;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revocationReason?: string;
}

/* ------------------------------------------------------------------ */
/*  Issuance form payload                                              */
/* ------------------------------------------------------------------ */

export interface IssuancePayload {
  credentialType: string;
  subjectNpi: string;
  subjectName: string;
  regulatoryBody?: string;
  licenseNumber?: string;
  issuedAt: string;
  expiresAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Bulk import row                                                    */
/* ------------------------------------------------------------------ */

export type ImportRowStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export interface ImportRow {
  rowNumber: number;
  subjectNpi: string;
  credentialType: string;
  status: ImportRowStatus;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Credential type options                                            */
/* ------------------------------------------------------------------ */

export const CREDENTIAL_TYPES = [
  'STATE_LICENSE',
  'BOARD_CERTIFICATION',
  'DEA_REGISTRATION',
  'NPI_ENROLLMENT',
  'EDUCATION',
  'TRAINING',
  'MALPRACTICE_INSURANCE',
  'BACKGROUND_CHECK',
] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  STATE_LICENSE: 'State License',
  BOARD_CERTIFICATION: 'Board Certification',
  DEA_REGISTRATION: 'DEA Registration',
  NPI_ENROLLMENT: 'NPI Enrollment',
  EDUCATION: 'Education',
  TRAINING: 'Training',
  MALPRACTICE_INSURANCE: 'Malpractice Insurance',
  BACKGROUND_CHECK: 'Background Check',
};

/* ------------------------------------------------------------------ */
/*  Status styling                                                     */
/* ------------------------------------------------------------------ */

export const STATUS_STYLES: Record<CredentialStatus, { label: string; color: string }> = {
  ACTIVE: {
    label: 'Active',
    color: 'text-[var(--trust-green)] border-[var(--trust-green)]/20 bg-[var(--trust-green)]/5',
  },
  EXPIRED: {
    label: 'Expired',
    color: 'text-[var(--trust-yellow)] border-[var(--trust-yellow)]/20 bg-[var(--trust-yellow)]/5',
  },
  REVOKED: {
    label: 'Revoked',
    color: 'text-destructive border-destructive/20 bg-destructive/5',
  },
  PENDING: {
    label: 'Pending',
    color: 'text-muted-foreground border-border bg-muted/20',
  },
};

/* ------------------------------------------------------------------ */
/*  Revocation reasons                                                 */
/* ------------------------------------------------------------------ */

export const REVOCATION_REASONS = [
  'License surrendered',
  'Disciplinary action',
  'Expiration not renewed',
  'Fraudulent documentation',
  'Superseded by new credential',
  'Administrative error',
  'Other',
] as const;
