-- B182A-TIMELINE-001: Credential timeline event ledger

CREATE TYPE "CredentialTimelineEventType" AS ENUM (
  'VC_ISSUED',
  'LICENSE_VERIFIED',
  'BOARD_VERIFIED',
  'DEA_VERIFIED',
  'PECOS_VERIFIED',
  'NPDB_QUERY',
  'PRIVILEGE_GRANTED',
  'FPPE_STARTED',
  'FPPE_COMPLETED',
  'OPPE_CYCLE',
  'REVALIDATION_CREATED',
  'COMPACT_ELIGIBILITY_UPDATED',
  'DISCREPANCY_FOUND'
);

CREATE TYPE "TimelineEventSeverity" AS ENUM ('INFO', 'NOTICE', 'WARNING', 'CRITICAL');

CREATE TABLE IF NOT EXISTS "CredentialTimelineEvent" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "eventType" "CredentialTimelineEventType" NOT NULL,
  "severity" "TimelineEventSeverity" NOT NULL DEFAULT 'INFO',
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "auditHash" TEXT NOT NULL,
  "anchorTxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CredentialTimelineEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CredentialTimelineEvent_auditHash_key" UNIQUE ("auditHash")
);

CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_clinician_ts_idx"
  ON "CredentialTimelineEvent" ("clinicianId", "timestamp");

CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_event_ts_idx"
  ON "CredentialTimelineEvent" ("eventType", "timestamp");

CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_severity_idx"
  ON "CredentialTimelineEvent" ("severity");

