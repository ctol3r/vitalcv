export const INGEST_SOURCE_IDS = ['nppes', 'oig', 'pecos'] as const;
export type IngestSourceId = (typeof INGEST_SOURCE_IDS)[number];

export type IngestEventType =
  | 'source_start'
  | 'source_complete'
  | 'claim_update'
  | 'passport_ready'
  | 'done'
  | 'error';

export type IngestRunStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
export type IngestSourceRunStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

export interface IngestEventPayload {
  [key: string]: unknown;
}

export interface PersistedIngestEvent {
  id: string;
  runId: string;
  sequence: number;
  type: IngestEventType;
  sourceId?: IngestSourceId;
  timestamp: string;
  payload: IngestEventPayload;
}

export interface PersistedIngestRun {
  id: string;
  npi: string;
  status: IngestRunStatus;
  entityId: string | null;
  lastError: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TERMINAL_INGEST_RUN_STATUSES = new Set<IngestRunStatus>(['DONE', 'ERROR']);
export const TERMINAL_INGEST_SOURCE_STATUSES = new Set<IngestSourceRunStatus>(['DONE', 'ERROR']);
