-- Wave 126: Persist trust registry, alerts, onboarding flows, and audit receipt metadata

ALTER TABLE "TrustedIssuer"
  ADD COLUMN "publicKeyPem" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "trustLevel" TEXT NOT NULL DEFAULT 'PROVISIONAL',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "trustScore" INTEGER,
  ADD COLUMN "verificationCount" INTEGER,
  ADD COLUMN "revocationCount" INTEGER,
  ADD COLUMN "lastScoredAt" TIMESTAMP(3),
  ADD COLUMN "assuranceProfile" TEXT,
  ADD COLUMN "algorithmPolicy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "haipCompliant" BOOLEAN,
  ADD COLUMN "federationEntityId" TEXT,
  ADD COLUMN "federationTrustChain" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "federatedAt" TIMESTAMP(3),
  ADD COLUMN "registryMetadata" JSONB;

UPDATE "TrustedIssuer"
SET "status" = CASE
  WHEN "active" = true THEN 'ACTIVE'
  ELSE 'SUSPENDED'
END
WHERE "status" IS NULL OR "status" = '';

CREATE INDEX "TrustedIssuer_status_idx" ON "TrustedIssuer"("status");
CREATE INDEX "TrustedIssuer_trustLevel_idx" ON "TrustedIssuer"("trustLevel");
CREATE INDEX "TrustedIssuer_active_idx" ON "TrustedIssuer"("active");

CREATE TABLE "TrustAlertRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "alertId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "credentialId" TEXT,
  "issuerId" TEXT,
  "subject" TEXT,
  "recommendedAction" TEXT NOT NULL,
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrustAlertRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustAlertRecord_alertId_key" UNIQUE ("alertId")
);

CREATE INDEX "TrustAlertRecord_severity_createdAt_idx" ON "TrustAlertRecord"("severity", "createdAt");
CREATE INDEX "TrustAlertRecord_acknowledged_createdAt_idx" ON "TrustAlertRecord"("acknowledged", "createdAt");
CREATE INDEX "TrustAlertRecord_issuerId_idx" ON "TrustAlertRecord"("issuerId");
CREATE INDEX "TrustAlertRecord_subject_idx" ON "TrustAlertRecord"("subject");

CREATE TABLE "MissionOpsOnboardingFlow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityName" TEXT NOT NULL,
  "stages" JSONB NOT NULL,
  "overallProgress" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MissionOpsOnboardingFlow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MissionOpsOnboardingFlow_role_entityId_key" UNIQUE ("role", "entityId")
);

CREATE INDEX "MissionOpsOnboardingFlow_role_lastUpdated_idx" ON "MissionOpsOnboardingFlow"("role", "lastUpdated");
CREATE INDEX "MissionOpsOnboardingFlow_entityId_idx" ON "MissionOpsOnboardingFlow"("entityId");

CREATE TABLE "AuditReceiptRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receiptId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditReceiptRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditReceiptRecord_receiptId_key" UNIQUE ("receiptId")
);

CREATE INDEX "AuditReceiptRecord_type_issuedAt_idx" ON "AuditReceiptRecord"("type", "issuedAt");
CREATE INDEX "AuditReceiptRecord_status_issuedAt_idx" ON "AuditReceiptRecord"("status", "issuedAt");
CREATE INDEX "AuditReceiptRecord_actor_idx" ON "AuditReceiptRecord"("actor");
CREATE INDEX "AuditReceiptRecord_subject_idx" ON "AuditReceiptRecord"("subject");
