export interface VerifyPassportRequest {
  passportId: string;
  externalRequestId?: string;
  includeLineage?: boolean;
}

export interface IssuerSummary {
  name: string;
  did?: string;
  endpoint?: string;
}

export interface HolderSummary {
  did: string;
  name?: string;
  email?: string;
}

export interface PassportAttestation {
  type: string;
  status: 'valid' | 'revoked' | 'unknown';
  issuedAt: string;
  expiresAt?: string;
  details?: Record<string, unknown>;
}

export interface VerifyPassportResponse {
  passportId: string;
  valid: boolean;
  issuedAt: string;
  expiresAt?: string;
  issuer: IssuerSummary;
  holder: HolderSummary;
  attestations: PassportAttestation[];
  lineage?: string[];
  metadata?: Record<string, unknown>;
}

export type TimelineEntryType =
  | 'VERIFICATION'
  | 'ENROLLMENT'
  | 'PASSPORT_ISSUED'
  | 'PASSPORT_REVOKED'
  | 'OTHER';

export interface TimelineEntry {
  id: string;
  organizationId: string;
  type: TimelineEntryType | string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  summary: string;
  details?: Record<string, unknown>;
  relatedIds?: string[];
}

export interface EnrollmentApplicant {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  npi?: string;
  credentials?: string[];
}

export interface EnrollmentDocument {
  type: string;
  filename?: string;
  url?: string;
  contentBase64?: string;
  hash?: string;
}

export interface EnrollmentRequest {
  organizationId: string;
  applicant: EnrollmentApplicant;
  documents?: EnrollmentDocument[];
  metadata?: Record<string, unknown>;
  notifyEmails?: string[];
}

export type EnrollmentStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface EnrollmentResponse {
  requestId: string;
  status: EnrollmentStatus;
  submittedAt: string;
  etaMinutes?: number;
  links?: {
    dashboard?: string;
    status?: string;
  };
}
