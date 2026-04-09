'use client';

export const INGEST_EVENT_TYPES = [
  'source_start',
  'source_complete',
  'claim_update',
  'passport_ready',
  'done',
  'error',
] as const;

export type IngestEventType = (typeof INGEST_EVENT_TYPES)[number];
export type IngestSourceResult = 'SUCCESS' | 'SKIPPED' | 'FAILED';
export type StreamPhase = 'idle' | 'starting' | 'nppes' | 'sanctions' | 'enrollment' | 'done' | 'error';
export type TrackedIngestSourceId = 'nppes' | 'oig' | 'pecos';

export interface RawIngestEvent {
  type?: unknown;
  source?: unknown;
  sourceId?: unknown;
  timestamp?: unknown;
  payload?: unknown;
}

export interface IngestEvent {
  type: IngestEventType;
  sourceId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
  rawEvent: RawIngestEvent;
}

export interface StreamIdentity {
  entityId?: string;
  displayName?: string;
  specialty?: string;
  credentials?: string;
  enumerationDate?: string;
  lastUpdated?: string;
  taxonomies?: Array<{ code: string; desc: string; primary: boolean }>;
  address?: { line1: string; city: string; state: string; zip: string; country: string; phone?: string };
  entityType?: string;
  npiType?: string;
  status?: string;
  sourceResult?: IngestSourceResult;
  authoritative: boolean;
}

export interface StreamStanding {
  exclusionChecked: boolean;
  exclusionClear?: boolean;
  exclusionStatus?: string;
  enrollmentChecked: boolean;
  enrollmentStatus?: string;
}

export interface StreamReadiness {
  score?: number;
  level?: string;
  status?: string;
  claimCount?: number;
  blockerCount?: number;
  credentialCount?: number;
  checkedAt?: string;
}

export interface SourceStatus {
  nppes: 'pending' | 'checking' | 'done' | 'error';
  oig: 'pending' | 'checking' | 'done' | 'error';
  pecos: 'pending' | 'checking' | 'done' | 'error';
}

export interface IngestStreamState {
  phase: StreamPhase;
  runId?: string;
  npi?: string;
  identity: StreamIdentity;
  standing: StreamStanding;
  readiness: StreamReadiness;
  sources: SourceStatus;
  events: IngestEvent[];
  error?: string;
  startedAt?: string;
  readyAt?: string;
  completedAt?: string;
  anchorEntityId?: string;
  isUsable: boolean;
  disconnected: boolean;
}

const INGEST_EVENT_TYPE_SET = new Set<string>(INGEST_EVENT_TYPES);
const TRACKED_SOURCE_IDS = new Set<TrackedIngestSourceId>(['nppes', 'oig', 'pecos']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return strings.length > 0 ? strings : undefined;
}

function normalizeSourceId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function isIngestEventType(value: string): value is IngestEventType {
  return INGEST_EVENT_TYPE_SET.has(value);
}

function readSourceResult(payload: Record<string, unknown>): IngestSourceResult | undefined {
  const value = readString(payload, 'resultStatus') ?? readString(payload, 'status');
  if (value === 'SUCCESS' || value === 'SKIPPED' || value === 'FAILED') {
    return value;
  }

  return undefined;
}

function sourceStateFromResult(result: IngestSourceResult | undefined): 'done' | 'error' {
  return result === 'FAILED' ? 'error' : 'done';
}

function markCheckingSourcesAsError(sources: SourceStatus): SourceStatus {
  return {
    nppes: sources.nppes === 'checking' ? 'error' : sources.nppes,
    oig: sources.oig === 'checking' ? 'error' : sources.oig,
    pecos: sources.pecos === 'checking' ? 'error' : sources.pecos,
  };
}

function isAuthoritativeIdentity(input: {
  displayName?: string;
  identityStatus?: string;
  sourceResult?: IngestSourceResult;
}): boolean {
  if (!input.displayName) {
    return false;
  }

  if (input.sourceResult && input.sourceResult !== 'SUCCESS') {
    return false;
  }

  return input.identityStatus?.toUpperCase() !== 'UNKNOWN';
}

function mergeIdentity(
  prev: StreamIdentity,
  payload: Record<string, unknown>,
): StreamIdentity {
  const displayName = readString(payload, 'displayName') ?? prev.displayName;
  const identityStatus = readString(payload, 'identityStatus') ?? prev.status;
  const sourceResult = readSourceResult(payload) ?? prev.sourceResult;

  let taxonomies = prev.taxonomies;
  if (Array.isArray(payload.taxonomies)) {
    taxonomies = payload.taxonomies as Array<{ code: string; desc: string; primary: boolean }>;
  }

  let address = prev.address;
  if (payload.address && typeof payload.address === 'object') {
    address = payload.address as { line1: string; city: string; state: string; zip: string; country: string; phone?: string };
  }

  return {
    entityId: readString(payload, 'entityId') ?? prev.entityId,
    displayName,
    specialty: readString(payload, 'specialty') ?? prev.specialty,
    credentials: readString(payload, 'credentials') ?? prev.credentials,
    enumerationDate: readString(payload, 'enumerationDate') ?? prev.enumerationDate,
    lastUpdated: readString(payload, 'lastUpdated') ?? prev.lastUpdated,
    taxonomies,
    address,
    entityType: readString(payload, 'entityType') ?? prev.entityType,
    npiType: readString(payload, 'npiType') ?? prev.npiType,
    status: identityStatus,
    sourceResult,
    authoritative: isAuthoritativeIdentity({
      displayName,
      identityStatus,
      sourceResult,
    }),
  };
}

function mergeStanding(
  prev: StreamStanding,
  payload: Record<string, unknown>,
): StreamStanding {
  const exclusionStatus = readString(payload, 'exclusionStatus');
  const enrollmentStatus = readString(payload, 'enrollmentStatus');

  return {
    exclusionChecked:
      readBoolean(payload, 'exclusionChecked')
      ?? (exclusionStatus !== undefined ? true : prev.exclusionChecked),
    exclusionClear: readBoolean(payload, 'exclusionClear') ?? prev.exclusionClear,
    exclusionStatus: exclusionStatus ?? prev.exclusionStatus,
    enrollmentChecked:
      readBoolean(payload, 'enrollmentChecked')
      ?? (enrollmentStatus !== undefined ? true : prev.enrollmentChecked),
    enrollmentStatus: enrollmentStatus ?? prev.enrollmentStatus,
  };
}

function mergeReadiness(
  prev: StreamReadiness,
  payload: Record<string, unknown>,
): StreamReadiness {
  const credentialIds = readStringArray(payload, 'credentialIds');

  return {
    score: readNumber(payload, 'readinessScore') ?? prev.score,
    level: readString(payload, 'readinessLevel') ?? prev.level,
    status: readString(payload, 'readinessStatus') ?? prev.status,
    claimCount: readNumber(payload, 'claimCount') ?? prev.claimCount,
    blockerCount: readNumber(payload, 'blockerCount') ?? prev.blockerCount,
    credentialCount:
      readNumber(payload, 'credentialCount')
      ?? (credentialIds ? credentialIds.length : prev.credentialCount),
    checkedAt: readString(payload, 'checkedAt') ?? prev.checkedAt,
  };
}

export function createInitialIngestStreamState(): IngestStreamState {
  return {
    phase: 'idle',
    identity: { authoritative: false },
    standing: { exclusionChecked: false, enrollmentChecked: false },
    readiness: {},
    sources: { nppes: 'pending', oig: 'pending', pecos: 'pending' },
    events: [],
    isUsable: false,
    disconnected: false,
  };
}

/**
 * Hydrate an IngestStreamState from the homepage preview's ClinicianTrustState.
 * Used when navigating from LiveTrustConsole → /passport to avoid re-running
 * NPPES and OIG checks that already completed on the homepage.
 *
 * The returned state has NPPES and OIG marked as done, PECOS still pending
 * (the passport SSE stream will fill it in). Phase is set to 'enrollment'
 * so the passport page knows to start from the PECOS check.
 */
export function hydrateFromHomepagePreview(preview: {
  npi: string;
  realState: {
    identityVerified: boolean;
    exclusionClear: boolean;
    exclusionStatus?: string;
    readiness_score: number;
    readiness_level: string;
    readiness_status: string;
    credentialCount: number;
    computed_at: string;
    methodology_version: string;
    facts: Array<{ factType: string; details?: string; source: string; status: string }>;
  } | null;
  stages: Array<{ id: string; status: string }>;
  isDemo: boolean;
}): IngestStreamState | null {
  const { realState } = preview;
  if (!realState || preview.isDemo) {
    return null;
  }

  const identityFact = realState.facts.find(
    f => f.factType === 'PERSONAL_IDENTITY' || f.factType === 'NPI_IDENTITY',
  );
  const specFact = realState.facts.find(f => f.factType === 'SPECIALTY');

  const nppesStage = preview.stages.find(s => s.id === 'NPPES_API');
  const oigStage = preview.stages.find(s => s.id === 'OIG_LEIE');

  return {
    phase: 'enrollment',
    npi: preview.npi,
    identity: {
      displayName: identityFact?.details ?? `NPI ${preview.npi}`,
      specialty: specFact?.details,
      authoritative: realState.identityVerified,
      status: realState.identityVerified ? 'VERIFIED' : 'UNKNOWN',
    },
    standing: {
      exclusionChecked: true,
      exclusionClear: realState.exclusionClear,
      exclusionStatus: realState.exclusionStatus,
      enrollmentChecked: false,
    },
    readiness: {
      score: realState.readiness_score,
      level: realState.readiness_level,
      status: realState.readiness_status,
      credentialCount: realState.credentialCount,
      checkedAt: realState.computed_at,
    },
    sources: {
      nppes: nppesStage?.status === 'ok' ? 'done' : 'pending',
      oig: oigStage?.status === 'ok' ? 'done' : 'pending',
      pecos: 'pending',
    },
    events: [],
    isUsable: false,
    disconnected: false,
    startedAt: new Date().toISOString(),
  };
}

export function normalizeIngestEvent(input: unknown): IngestEvent | null {
  const rawEvent = asRecord(input);
  if (!rawEvent) {
    return null;
  }

  const type = readString(rawEvent, 'type');
  const timestamp = readString(rawEvent, 'timestamp');
  if (!type || !timestamp || !isIngestEventType(type)) {
    return null;
  }

  const payload = asRecord(rawEvent.payload) ?? {};
  const sourceId = normalizeSourceId(
    readString(rawEvent, 'sourceId')
    ?? readString(rawEvent, 'source')
    ?? readString(payload, 'sourceId')
    ?? readString(payload, 'source'),
  );

  return {
    type,
    sourceId,
    timestamp,
    payload,
    rawEvent: {
      type: rawEvent.type,
      source: rawEvent.source,
      sourceId: rawEvent.sourceId,
      timestamp: rawEvent.timestamp,
      payload: rawEvent.payload,
    },
  };
}

export function parseIngestEventData(data: string): IngestEvent | null {
  try {
    return normalizeIngestEvent(JSON.parse(data) as unknown);
  } catch {
    return null;
  }
}

export function applyIngestEvent(prev: IngestStreamState, event: IngestEvent): IngestStreamState {
  const events = [...prev.events, event];

  switch (event.type) {
    case 'source_start': {
      if (!event.sourceId || !TRACKED_SOURCE_IDS.has(event.sourceId as TrackedIngestSourceId)) {
        return { ...prev, events, disconnected: false };
      }

      if (event.sourceId === 'nppes') {
        return {
          ...prev,
          events,
          phase: 'nppes',
          disconnected: false,
          sources: { ...prev.sources, nppes: 'checking' },
        };
      }

      if (event.sourceId === 'oig') {
        return {
          ...prev,
          events,
          phase: 'sanctions',
          disconnected: false,
          sources: { ...prev.sources, oig: 'checking' },
        };
      }

      return {
        ...prev,
        events,
        disconnected: false,
        sources: { ...prev.sources, pecos: 'checking' },
      };
    }

    case 'source_complete': {
      const result = readSourceResult(event.payload);

      if (event.sourceId === 'nppes') {
        return {
          ...prev,
          events,
          disconnected: false,
          identity: mergeIdentity(prev.identity, event.payload),
          sources: {
            ...prev.sources,
            nppes: sourceStateFromResult(result),
          },
        };
      }

      if (event.sourceId === 'oig') {
        return {
          ...prev,
          events,
          phase: 'enrollment',
          disconnected: false,
          standing: {
            ...mergeStanding(prev.standing, event.payload),
            exclusionChecked: true,
          },
          sources: {
            ...prev.sources,
            oig: sourceStateFromResult(result),
          },
        };
      }

      if (event.sourceId === 'pecos') {
        return {
          ...prev,
          events,
          disconnected: false,
          standing: {
            ...mergeStanding(prev.standing, event.payload),
            enrollmentChecked: true,
          },
          sources: {
            ...prev.sources,
            pecos: sourceStateFromResult(result),
          },
        };
      }

      return { ...prev, events, disconnected: false };
    }

    case 'claim_update':
      return {
        ...prev,
        events,
        disconnected: false,
        readiness: mergeReadiness(prev.readiness, event.payload),
      };

    case 'passport_ready': {
      const identity = mergeIdentity(prev.identity, event.payload);
      const anchorEntityId = readString(event.payload, 'entityId') ?? prev.anchorEntityId ?? identity.entityId;
      const isUsable = Boolean(anchorEntityId) && identity.authoritative;

      return {
        ...prev,
        events,
        disconnected: false,
        identity,
        standing: mergeStanding(prev.standing, event.payload),
        readiness: mergeReadiness(prev.readiness, event.payload),
        anchorEntityId: isUsable ? anchorEntityId : undefined,
        isUsable,
        readyAt: isUsable ? event.timestamp : prev.readyAt,
        error: isUsable ? undefined : prev.error,
      };
    }

    case 'done': {
      const doneIdentity =
        readString(event.payload, 'entityId') && !prev.identity.entityId
          ? { ...prev.identity, entityId: readString(event.payload, 'entityId') }
          : prev.identity;
      const anchorEntityId = prev.anchorEntityId ?? doneIdentity.entityId;
      const isUsable = prev.isUsable || (Boolean(anchorEntityId) && doneIdentity.authoritative);

      return {
        ...prev,
        events,
        phase: 'done',
        disconnected: false,
        identity: doneIdentity,
        readiness: mergeReadiness(prev.readiness, event.payload),
        anchorEntityId: isUsable ? anchorEntityId : undefined,
        isUsable,
        error: isUsable ? undefined : prev.error,
        completedAt: event.timestamp,
      };
    }

    case 'error':
      if (prev.isUsable) {
        return {
          ...prev,
          events,
          disconnected: false,
        };
      }

      return {
        ...prev,
        events,
        phase: 'error',
        disconnected: false,
        sources: markCheckingSourcesAsError(prev.sources),
        error: readString(event.payload, 'message') ?? 'Something went wrong.',
        completedAt: event.timestamp,
      };
  }
}

export function applyIngestDisconnect(
  prev: IngestStreamState,
  disconnectedAt: string = new Date().toISOString(),
): IngestStreamState {
  if (prev.isUsable) {
    return {
      ...prev,
      disconnected: false,
      error: undefined,
    };
  }

  return {
    ...prev,
    phase: 'error',
    disconnected: true,
    sources: markCheckingSourcesAsError(prev.sources),
    error: 'Stream disconnected.',
    completedAt: prev.completedAt ?? disconnectedAt,
  };
}

export function parseIngestStartResponse(input: {
  ok: boolean;
  status: number;
  body: unknown;
}): string {
  const body = asRecord(input.body) ?? {};
  const runId = readString(body, 'runId');

  if (input.ok && runId) {
    return runId;
  }

  throw new Error(
    readString(body, 'error')
    ?? readString(body, 'message')
    ?? (input.ok ? 'Ingest run did not return a runId.' : `Failed to start ingest (${input.status}).`),
  );
}

// ── Homepage → Passport hydration ───────────────────────────────────────────

interface HomepagePreviewData {
  npi: string;
  realState: {
    identityVerified: boolean;
    exclusionClear: boolean;
    exclusionStatus?: string;
    readiness_level?: string;
    readiness_score?: number;
    credentialCount?: number;
    gaps?: string[];
    facts?: Array<{
      factType: string;
      source: string;
      status: string;
      details?: string;
    }>;
  } | null;
  stages: Array<{ id: string; status: string }>;
  isDemo: boolean;
}

