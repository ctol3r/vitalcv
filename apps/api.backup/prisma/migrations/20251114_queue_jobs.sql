-- B163A-QUEUE-001: JobQueue table + status enum for background worker

CREATE TYPE "JobQueueStatus" AS ENUM ('PENDING','RUNNING','FAILED','FAILED_FINAL','COMPLETED');

CREATE TABLE IF NOT EXISTS "JobQueue" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "JobQueueStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobQueue_status_createdAt_idx"
  ON "JobQueue" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "JobQueue_type_idx"
  ON "JobQueue" ("type");
CREATE INDEX IF NOT EXISTS "JobQueue_createdAt_idx"
  ON "JobQueue" ("createdAt");
