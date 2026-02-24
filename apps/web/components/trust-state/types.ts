// ─────────────────────────────────────────────────────────────
// Trust-State UI Types — derived from PsvArtifact (psv.ts)
// No `any`. Strict. Matches backend artifact shapes exactly.
// ─────────────────────────────────────────────────────────────

export type TrustBand = 'GREEN' | 'YELLOW' | 'RED';

export type ClaimLevel = 'L0' | 'L1' | 'L2' | 'L3';

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

export interface TrustStateCrs {
  score: number;
  band: TrustBand;
  factors?: Record<string, unknown>;
}

export interface TrustStateTimelineEvent {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  employer: string | null;
  facility: string | null;
  metadata: Record<string, unknown>;
}

export interface TrustStateAcceptanceDetails {
  employerId: string;
  facilityId: string;
  role: string;
  acceptedAt: string;
}

export interface TrustStateIntakeSummary {
  identities_count: number;
  candidate_credentials_count: number;
  unverified_credentials_count: number;
}

export interface TrustStateResponse {
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  start_ready: boolean;
  crs: TrustStateCrs;
  blocking_reasons: string[];
  blocking_reason_messages?: string[];
  timeline_preview: TrustStateTimelineEvent[];
  recognitionId?: string;
  acceptanceId?: string;
  startId?: string;
  recognizedAt?: string;
  acceptedAt?: string;
  attestedAt?: string;
  acceptanceDetails?: TrustStateAcceptanceDetails | null;
  intake_summary?: TrustStateIntakeSummary;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toStringRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeTrustBand(value: unknown): TrustBand {
  return value === 'GREEN' || value === 'YELLOW' || value === 'RED'
    ? value
    : 'RED';
}

export function normalizeTrustStateResponse(raw: unknown): TrustStateResponse {
  const fallback: TrustStateResponse = {
    recognized: false,
    accepted: false,
    started: false,
    start_ready: false,
    crs: {
      score: 0,
      band: 'RED',
      factors: {},
    },
    blocking_reasons: [],
    timeline_preview: [],
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const data = raw as Record<string, unknown>;
  const crsRecord = toStringRecord(data.crs);
  const score = Number(crsRecord.score);
  const factors = toStringRecord(crsRecord.factors);
  const timeline = Array.isArray(data.timeline_preview)
    ? data.timeline_preview
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => {
          const timelineEntry = entry as Record<string, unknown>;
          return {
            id: String(timelineEntry.id ?? ''),
            type: String(timelineEntry.type ?? ''),
            label: String(timelineEntry.label ?? ''),
            timestamp: String(timelineEntry.timestamp ?? ''),
            employer: typeof timelineEntry.employer === 'string'
              ? timelineEntry.employer
              : null,
            facility: typeof timelineEntry.facility === 'string'
              ? timelineEntry.facility
              : null,
            metadata: toStringRecord(timelineEntry.metadata),
          };
        })
    : [];

  const acceptanceDetails = toStringRecord(data.acceptanceDetails);

  const acceptance: TrustStateAcceptanceDetails | null =
    typeof acceptanceDetails.employerId === 'string' &&
    typeof acceptanceDetails.facilityId === 'string' &&
    typeof acceptanceDetails.role === 'string' &&
    typeof acceptanceDetails.acceptedAt === 'string'
      ? {
          employerId: acceptanceDetails.employerId,
          facilityId: acceptanceDetails.facilityId,
          role: acceptanceDetails.role,
          acceptedAt: acceptanceDetails.acceptedAt,
        }
      : null;

  return {
    recognized: Boolean(data.recognized),
    accepted: Boolean(data.accepted),
    started: Boolean(data.started),
    start_ready: Boolean(data.start_ready),
    crs: {
      score: Number.isFinite(score) ? score : 0,
      band: normalizeTrustBand(crsRecord.band),
      factors,
    },
    blocking_reasons: normalizeStringArray(data.blocking_reasons),
    blocking_reason_messages: normalizeStringArray(data.blocking_reason_messages),
    timeline_preview: timeline,
    recognitionId: typeof data.recognitionId === 'string'
      ? data.recognitionId
      : undefined,
    acceptanceId: typeof data.acceptanceId === 'string'
      ? data.acceptanceId
      : undefined,
    startId: typeof data.startId === 'string' ? data.startId : undefined,
    recognizedAt: typeof data.recognizedAt === 'string'
      ? data.recognizedAt
      : undefined,
    acceptedAt: typeof data.acceptedAt === 'string'
      ? data.acceptedAt
      : undefined,
    attestedAt: typeof data.attestedAt === 'string'
      ? data.attestedAt
      : undefined,
    acceptanceDetails: acceptance,
    intake_summary:
      typeof data.intake_summary === 'object' &&
      data.intake_summary !== null
        ? (data.intake_summary as TrustStateIntakeSummary)
        : undefined,
  };
}
