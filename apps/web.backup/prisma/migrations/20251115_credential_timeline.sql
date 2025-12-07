-- B182A-TIMELINE-001..003: Credential timeline base table + audit hash anchoring

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CredentialTimelineEventType') THEN
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
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimelineEventSeverity') THEN
    CREATE TYPE "TimelineEventSeverity" AS ENUM ('INFO','NOTICE','WARNING','CRITICAL');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "CredentialTimelineEvent" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "eventType" "CredentialTimelineEventType" NOT NULL,
  "severity" "TimelineEventSeverity" NOT NULL DEFAULT 'INFO',
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "auditHash" TEXT NOT NULL,
  "anchorTxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CredentialTimelineEvent_audit_hash_uq"
  ON "CredentialTimelineEvent" ("auditHash");
CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_clinician_ts_idx"
  ON "CredentialTimelineEvent" ("clinicianId", "timestamp");
CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_event_ts_idx"
  ON "CredentialTimelineEvent" ("eventType", "timestamp");
CREATE INDEX IF NOT EXISTS "CredentialTimelineEvent_severity_idx"
  ON "CredentialTimelineEvent" ("severity");


