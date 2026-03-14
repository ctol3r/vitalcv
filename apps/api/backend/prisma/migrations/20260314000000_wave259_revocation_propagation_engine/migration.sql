-- Wave 259: Revocation Propagation Engine outbox

CREATE TABLE "RevocationOutboxEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "employerId" TEXT NOT NULL,
  "organizationId" UUID,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),

  CONSTRAINT "RevocationOutboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevocationOutboxEvent_dedupeKey_key" UNIQUE ("dedupeKey")
);

CREATE INDEX "RevocationOutboxEvent_status_availableAt_idx"
  ON "RevocationOutboxEvent"("status", "availableAt");
CREATE INDEX "RevocationOutboxEvent_artifactId_status_idx"
  ON "RevocationOutboxEvent"("artifactId", "status");
CREATE INDEX "RevocationOutboxEvent_employerId_status_idx"
  ON "RevocationOutboxEvent"("employerId", "status");
CREATE INDEX "RevocationOutboxEvent_organizationId_status_idx"
  ON "RevocationOutboxEvent"("organizationId", "status");
