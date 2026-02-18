// ─────────────────────────────────────────────────────────────
// Trust-State UI Types — derived from PsvArtifact (psv.ts)
// No `any`. Strict. Matches backend artifact shapes exactly.
// ─────────────────────────────────────────────────────────────

export type TrustBand = 'GREEN' | 'YELLOW' | 'RED';

export type WindowStatus =
  | 'WITHIN_WINDOW'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'NOT_YET_VALID';

export type CredentialStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'PENDING'
  | 'NOT_FOUND'
  | 'UNKNOWN';

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

// ── Panel Data Shapes ──────────────────────────────────────

export interface TrustStateCardData {
  band: TrustBand;
  windowStatus: WindowStatus;
  verifiedAt: string;
  validUntil: string;
  daysRemaining: number;
  windowDays: number;
  startReady: boolean;
  blockingReasons: string[];
}

export interface CredentialRow {
  credentialType: CredentialType;
  status: CredentialStatus;
  issuer: string;
  issuingStateOrBody: string;
  credentialIdentifier: string;
  issueDate: string;
  expirationDate: string;
}

export interface RetrievalData {
  method: RetrievalMethod;
  retrievedAt: string;
  agent: { system: string; version: string };
  source: {
    sourceType: SourceType;
    sourceName: string;
    sourceUrl: string;
    authoritative: boolean;
  };
}

export interface CredentialPanelData {
  credentials: CredentialRow[];
  retrieval: RetrievalData;
}

export interface ChangeField {
  field: string;
  previousValue: string;
  newValue: string;
}

export interface DeltaLogEntry {
  deltaId: string;
  detectedAt: string;
  changeSet: {
    changedFields: ChangeField[];
    materialChange: boolean;
    changeHash: string;
  };
  previousArtifactHash: string;
  newArtifactHash: string;
}

export interface MonitoringPanelData {
  enabled: boolean;
  lastCheckedAt: string;
  checkIntervalHours: number;
  deltaLog: DeltaLogEntry[];
}

export interface IntegrityPanelData {
  rawPayloadHash: string;
  artifactHash: string;
  signatureAlgorithm: 'ES256';
  publicKeyId: string;
  signedAt: string;
}

// ── Composite ───────────────────────────────────────────────

export interface TrustStateViewData {
  artifactId: string;
  npi: string;
  providerName: string;
  trustState: TrustStateCardData;
  credentials: CredentialPanelData;
  monitoring: MonitoringPanelData;
  integrity: IntegrityPanelData;
}
