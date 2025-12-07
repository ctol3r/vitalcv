-- B198A-QUEUE-002/003: Idempotency support + DLQ table for queue worker

ALTER TABLE "JobQueue"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "JobQueue_type_idempotencyKey_key"
  ON "JobQueue" ("type", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "JobQueue_idempotencyKey_idx"
  ON "JobQueue" ("idempotencyKey");

CREATE TABLE IF NOT EXISTS "DLQJobQueue" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "traceContext" JSONB,
  "idempotencyKey" TEXT,
  "attempts" INTEGER NOT NULL,
  "maxAttempts" INTEGER NOT NULL,
  "error" JSONB NOT NULL,
  "lastError" TEXT,
  "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DLQJobQueue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DLQJobQueue_jobId_key" UNIQUE ("jobId")
);

CREATE INDEX IF NOT EXISTS "DLQJobQueue_type_idx"
  ON "DLQJobQueue" ("type");

CREATE INDEX IF NOT EXISTS "DLQJobQueue_idempotencyKey_idx"
  ON "DLQJobQueue" ("idempotencyKey");

CREATE INDEX IF NOT EXISTS "DLQJobQueue_movedAt_idx"
  ON "DLQJobQueue" ("movedAt");

