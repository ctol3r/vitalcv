-- B194B-QFUSION-006: QualityCredentialFusion model storage

CREATE TABLE IF NOT EXISTS "QualityCredentialFusion" (
  "clinicianId" TEXT PRIMARY KEY,
  "compositeScore" INTEGER NOT NULL DEFAULT 0,
  "contributingQualitySignals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "contributingCredentialSignals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "complianceFindings" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "recommendedActions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ruleMatches" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "QualityCredentialFusion_updatedAt_idx"
  ON "QualityCredentialFusion" ("updatedAt");

CREATE INDEX IF NOT EXISTS "QualityCredentialFusion_score_idx"
  ON "QualityCredentialFusion" ("compositeScore");


