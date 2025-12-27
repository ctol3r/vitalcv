import type { AuditEventType } from '../audit/service';

export type CredentialStatus = 'active' | 'revoked' | 'expired';

export interface Credential {
  id: string;
  subjectId: string;
  issuerId: string;
  jwt: string;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string | null;
  proofHash: string;
}

export interface Revocation {
  credentialId: string;
  reason?: string | null;
  revokedAt: string;
  revokedBy?: string | null;
}

export type VerificationStatus = CredentialStatus | 'invalid' | 'unknown';

export interface VerificationResult {
  valid: boolean;
  proofHash: string;
  auditRef: string;
  status: VerificationStatus;
  reason?: string;
}

export interface ReceiptTimelineEntry {
  type: AuditEventType | string;
  at: string;
  hash: string;
  metadata?: Record<string, unknown> | null;
}
