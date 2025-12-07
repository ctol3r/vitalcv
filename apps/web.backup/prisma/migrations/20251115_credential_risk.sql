-- B179A-RISK-001: CredentialRisk model for clinician scoring

CREATE TABLE IF NOT EXISTS "CredentialRisk" (
  "clinicianId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "factors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CredentialRisk_pkey" PRIMARY KEY ("clinicianId")
);

CREATE INDEX IF NOT EXISTS "CredentialRisk_updatedAt_idx" ON "CredentialRisk" ("updatedAt");
CREATE INDEX IF NOT EXISTS "CredentialRisk_score_idx" ON "CredentialRisk" ("score");

