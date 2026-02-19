// ─────────────────────────────────────────────────────────────
// PSV Artifact Type System — Single Source of Truth
// No `any`. No optional integrity fields. No Date objects.
// ─────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────

export type ProviderType = 'INDIVIDUAL' | 'ORGANIZATION';

export type CredentialType =
  | 'STATE_LICENSE'
  | 'BOARD_CERTIFICATION'
  | 'DEA_REGISTRATION'
  | 'NPI_ENROLLMENT'
  | 'EDUCATION'
  | 'TRAINING'
  | 'MALPRACTICE'
  | 'SANCTIONS'
  | 'OIG_EXCLUSION'
  | 'SAM_EXCLUSION'
  | 'NPDB'
  | 'WORK_HISTORY'
  | 'PEER_REFERENCE';

export type CredentialStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'PENDING'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export type SourceType =
  | 'NPPES'
  | 'NURSYS'
  | 'ABMS'
  | 'DEA'
  | 'STATE_BOARD'
  | 'NCSBN'
  | 'OIG'
  | 'SAM'
  | 'NPDB'
  | 'INSTITUTION';

export type RetrievalMethod =
  | 'API'
  | 'SCRAPE'
  | 'MANUAL'
  | 'BULK_DOWNLOAD'
  | 'DELEGATION';

export type WindowStatus =
  | 'WITHIN_WINDOW'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'NOT_YET_VALID';

// ── Value Objects ────────────────────────────────────────────

export interface CompactName {
  first: string;
  last: string;
  middle: string;
  suffix: string;
  credential: string;
}

export interface Provider {
  npi: string;
  type: ProviderType;
  name: CompactName;
  enumerationDate: string; // ISO 8601
  lastUpdated: string;     // ISO 8601
  status: 'ACTIVE' | 'DEACTIVATED';
}

export interface Credential {
  credentialType: CredentialType;
  status: CredentialStatus;
  issuer: string;
  issuingStateOrBody: string;
  credentialIdentifier: string;
  issueDate: string;        // ISO 8601
  expirationDate: string;   // ISO 8601
  compactStatus: string;
}

export interface PrimarySource {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  authoritative: boolean;
}

export interface RetrievalAgent {
  system: string;
  version: string;
}

export interface RetrievalEvent {
  method: RetrievalMethod;
  retrievedAt: string;  // ISO 8601
  agent: RetrievalAgent;
  source: PrimarySource;
}

// ── Integrity ────────────────────────────────────────────────

export interface EvidenceIntegrity {
  rawPayloadHash: string;
  artifactHash: string;
  signatureAlgorithm: 'ES256';
  signature: string;
  publicKeyId: string;
  signedAt: string; // ISO 8601
}

// ── Decision Window ──────────────────────────────────────────

export interface DecisionWindow {
  windowStatus: WindowStatus;
  verifiedAt: string;       // ISO 8601
  validUntil: string;       // ISO 8601
  windowDays: number;
  daysRemaining: number;
}

// ── Monitoring / Delta ───────────────────────────────────────

export interface ChangeField {
  field: string;
  previousValue: string;
  newValue: string;
}

export interface ChangeSet {
  changedFields: ChangeField[];
  materialChange: boolean;
  changeHash: string;
}

export interface DeltaLogEntry {
  deltaId: string;
  detectedAt: string;  // ISO 8601
  changeSet: ChangeSet;
  previousArtifactHash: string;
  newArtifactHash: string;
}

export interface Monitoring {
  enabled: boolean;
  lastCheckedAt: string;   // ISO 8601
  checkIntervalHours: number;
  deltaLog: DeltaLogEntry[];
}

// ── Enrollment ───────────────────────────────────────────────

export interface EnrollmentAttestation {
  enrollmentType: string;
  status: CredentialStatus;
  effectiveDate: string;   // ISO 8601
  terminationDate: string; // ISO 8601 or empty
}

export interface EnrollmentContext {
  medicareEnrollment: EnrollmentAttestation;
  medicaidEnrollment: EnrollmentAttestation;
  stateSpecific: Record<string, string>;
}

// ── Top-Level Artifact ───────────────────────────────────────

export interface PsvArtifact {
  artifactId: string;
  artifactVersion: '1.0';
  generatedAt: string;  // ISO 8601
  provider: Provider;
  credentials: Credential[];
  retrieval: RetrievalEvent;
  integrity: EvidenceIntegrity;
  decisionWindow: DecisionWindow;
  monitoring: Monitoring;
  enrollment: EnrollmentContext;
  deltaLog: DeltaLogEntry[];
}

// ── Adapter Payload (used between adapter and builder) ───────

export interface NormalizedCredentialPayload {
  provider: Provider;
  credentials: Credential[];
  retrieval: RetrievalEvent;
  enrollment: EnrollmentContext;
  rawPayload: Record<string, unknown>;
}
