-- B169B-REV-001: Revalidation task enums & table

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskType') THEN
    CREATE TYPE "RevalidationTaskType" AS ENUM ('PECOS','MEDICAID','PAYER','CREDENTIALING');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskStatus') THEN
    CREATE TYPE "RevalidationTaskStatus" AS ENUM ('OPEN','IN_PROGRESS','COMPLETED','OVERDUE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskSource') THEN
    CREATE TYPE "RevalidationTaskSource" AS ENUM ('SYSTEM','USER','INTEGRATION','IMPORT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "RevalidationTask" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "type" "RevalidationTaskType" NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "RevalidationTaskStatus" NOT NULL DEFAULT 'OPEN',
  "source" "RevalidationTaskSource" NOT NULL DEFAULT 'SYSTEM',
  "notes" TEXT,
  "metadata" JSONB,
  "completedAt" TIMESTAMP(3),
  "lastNotifiedAt" TIMESTAMP(3),
  "notificationCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RevalidationTask_clinicianId_idx"
  ON "RevalidationTask" ("clinicianId");
CREATE INDEX IF NOT EXISTS "RevalidationTask_dueDate_idx"
  ON "RevalidationTask" ("dueDate");
CREATE INDEX IF NOT EXISTS "RevalidationTask_status_idx"
  ON "RevalidationTask" ("status");
CREATE INDEX IF NOT EXISTS "RevalidationTask_type_status_idx"
  ON "RevalidationTask" ("type", "status");
CREATE INDEX IF NOT EXISTS "RevalidationTask_source_idx"
  ON "RevalidationTask" ("source");
CREATE INDEX IF NOT EXISTS "RevalidationTask_lastNotifiedAt_idx"
  ON "RevalidationTask" ("lastNotifiedAt");
-- B169B-REV-001: RevalidationTask model with enums + notification metadata

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskType') THEN
    CREATE TYPE "RevalidationTaskType" AS ENUM ('PECOS', 'MEDICAID', 'PAYER', 'CREDENTIALING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskStatus') THEN
    CREATE TYPE "RevalidationTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevalidationTaskSource') THEN
    CREATE TYPE "RevalidationTaskSource" AS ENUM ('SYSTEM', 'USER', 'INTEGRATION', 'IMPORT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "RevalidationTask" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "type" "RevalidationTaskType" NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "status" "RevalidationTaskStatus" NOT NULL DEFAULT 'OPEN',
  "source" "RevalidationTaskSource" NOT NULL DEFAULT 'SYSTEM',
  "notes" TEXT,
  "metadata" JSONB,
  "completedAt" TIMESTAMPTZ,
  "lastNotifiedAt" TIMESTAMPTZ,
  "notificationCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RevalidationTask_clinicianId_idx" ON "RevalidationTask"("clinicianId");
CREATE INDEX IF NOT EXISTS "RevalidationTask_dueDate_idx" ON "RevalidationTask"("dueDate");
CREATE INDEX IF NOT EXISTS "RevalidationTask_status_idx" ON "RevalidationTask"("status");
CREATE INDEX IF NOT EXISTS "RevalidationTask_type_status_idx" ON "RevalidationTask"("type", "status");
CREATE INDEX IF NOT EXISTS "RevalidationTask_source_idx" ON "RevalidationTask"("source");
CREATE INDEX IF NOT EXISTS "RevalidationTask_lastNotifiedAt_idx" ON "RevalidationTask"("lastNotifiedAt");

