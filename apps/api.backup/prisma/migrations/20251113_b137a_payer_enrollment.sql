-- B137A Payer Enrollment System Migration
-- Tasks: B137A-PAYER-001, B137A-PAYER-002, B137A-CAQH-003, B137A-PECOS-005, B137A-JOBLINK-012, B137A-NCQA-011

-- B137A-PAYER-002: Create Payer table
CREATE TABLE "Payer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "payerId" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "planTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enrollmentEndpoint" TEXT,
  "x12SubmitEndpoint" TEXT,
  "contactInfo" JSONB,
  "requiresCaqh" BOOLEAN NOT NULL DEFAULT true,
  "requiresPecos" BOOLEAN NOT NULL DEFAULT false,
  "specialty" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Payer_payerId_idx" ON "Payer"("payerId");
CREATE INDEX "Payer_name_idx" ON "Payer"("name");
CREATE INDEX "Payer_isActive_idx" ON "Payer"("isActive");

-- B137A-PAYER-001, B137A-PECOS-005: Create PayerEnrollment table
CREATE TABLE "PayerEnrollment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "payerId" TEXT NOT NULL,
  "clinicianDid" TEXT NOT NULL,
  "caqhId" TEXT,
  "pecosId" TEXT,
  "pecosEnrollmentId" TEXT,
  "pecosStatus" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidenceBundle" JSONB,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "terminatedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "revalidationDueAt" TIMESTAMP(3),
  "anchoredHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayerEnrollment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PayerEnrollment_orgId_idx" ON "PayerEnrollment"("orgId");
CREATE INDEX "PayerEnrollment_payerId_idx" ON "PayerEnrollment"("payerId");
CREATE INDEX "PayerEnrollment_clinicianDid_idx" ON "PayerEnrollment"("clinicianDid");
CREATE INDEX "PayerEnrollment_caqhId_idx" ON "PayerEnrollment"("caqhId");
CREATE INDEX "PayerEnrollment_pecosId_idx" ON "PayerEnrollment"("pecosId");
CREATE INDEX "PayerEnrollment_status_idx" ON "PayerEnrollment"("status");
CREATE INDEX "PayerEnrollment_submittedAt_idx" ON "PayerEnrollment"("submittedAt");
CREATE INDEX "PayerEnrollment_revalidationDueAt_idx" ON "PayerEnrollment"("revalidationDueAt");

-- B137A-NCQA-011: Create PayerEnrollmentEvent table for evidence logging
CREATE TABLE "PayerEnrollmentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "enrollmentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "evidenceHash" TEXT,
  "anchoredTxHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayerEnrollmentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PayerEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PayerEnrollmentEvent_enrollmentId_idx" ON "PayerEnrollmentEvent"("enrollmentId");
CREATE INDEX "PayerEnrollmentEvent_eventType_idx" ON "PayerEnrollmentEvent"("eventType");
CREATE INDEX "PayerEnrollmentEvent_source_idx" ON "PayerEnrollmentEvent"("source");
CREATE INDEX "PayerEnrollmentEvent_createdAt_idx" ON "PayerEnrollmentEvent"("createdAt");

-- B137A-CAQH-003: Add caqhProfileId to NpiClaim table
ALTER TABLE "NpiClaim" ADD COLUMN "caqhProfileId" TEXT;
CREATE INDEX "NpiClaim_caqhProfileId_idx" ON "NpiClaim"("caqhProfileId");

-- B137A-JOBLINK-012: Add payerEnrollmentId to Application table
ALTER TABLE "Application" ADD COLUMN "payerEnrollmentId" TEXT;
CREATE INDEX "Application_payerEnrollmentId_idx" ON "Application"("payerEnrollmentId");
ALTER TABLE "Application" ADD CONSTRAINT "Application_payerEnrollmentId_fkey"
  FOREIGN KEY ("payerEnrollmentId") REFERENCES "PayerEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed initial payers (common US health insurance companies)
INSERT INTO "Payer" ("id", "payerId", "name", "planTypes", "requiresCaqh", "requiresPecos", "specialty", "states", "isActive", "createdAt", "updatedAt")
VALUES
  ('payer_aetna', 'AETNA', 'Aetna', ARRAY['HMO', 'PPO', 'POS'], true, false, ARRAY['207R00000X', '208D00000X', '207Q00000X'], ARRAY['CA', 'NY', 'TX', 'FL'], true, NOW(), NOW()),
  ('payer_uhc', 'UHC', 'UnitedHealthcare', ARRAY['HMO', 'PPO', 'EPO'], true, false, ARRAY['207R00000X', '208D00000X'], ARRAY['CA', 'NY', 'TX', 'FL', 'IL'], true, NOW(), NOW()),
  ('payer_anthem', 'ANTHEM', 'Anthem Blue Cross Blue Shield', ARRAY['HMO', 'PPO', 'HDHP'], true, false, ARRAY['207R00000X', '208D00000X', '207Q00000X'], ARRAY['CA', 'NY', 'TX'], true, NOW(), NOW()),
  ('payer_cigna', 'CIGNA', 'Cigna', ARRAY['HMO', 'PPO', 'EPO'], true, false, ARRAY['207R00000X', '208D00000X'], ARRAY['CA', 'NY', 'FL'], true, NOW(), NOW()),
  ('payer_humana', 'HUMANA', 'Humana', ARRAY['HMO', 'PPO', 'Medicare Advantage'], true, false, ARRAY['207R00000X', '208D00000X', '207Q00000X'], ARRAY['FL', 'TX', 'KY'], true, NOW(), NOW()),
  ('payer_bcbs', 'BCBS', 'Blue Cross Blue Shield', ARRAY['HMO', 'PPO', 'POS'], true, false, ARRAY['207R00000X', '208D00000X', '207Q00000X'], ARRAY['CA', 'NY', 'TX', 'FL', 'IL', 'PA'], true, NOW(), NOW()),
  ('payer_kaiser', 'KAISER', 'Kaiser Permanente', ARRAY['HMO'], true, false, ARRAY['207R00000X', '208D00000X'], ARRAY['CA', 'OR', 'WA', 'CO'], true, NOW(), NOW()),
  ('payer_medicare', 'CMS_MEDICARE', 'Medicare (CMS)', ARRAY['Medicare Part A', 'Medicare Part B', 'Medicare Advantage'], true, true, ARRAY['207R00000X', '208D00000X', '207Q00000X', '2080P0216X'], ARRAY['ALL'], true, NOW(), NOW()),
  ('payer_medicaid_ca', 'CA_MEDICAID', 'California Medicaid (Medi-Cal)', ARRAY['Medicaid'], true, false, ARRAY['207R00000X', '208D00000X'], ARRAY['CA'], true, NOW(), NOW()),
  ('payer_medicaid_ny', 'NY_MEDICAID', 'New York Medicaid', ARRAY['Medicaid'], true, false, ARRAY['207R00000X', '208D00000X'], ARRAY['NY'], true, NOW(), NOW())
ON CONFLICT ("payerId") DO NOTHING;

COMMENT ON TABLE "Payer" IS 'B137A-PAYER-002: Payer configuration for enrollment endpoints';
COMMENT ON TABLE "PayerEnrollment" IS 'B137A-PAYER-001: Payer enrollment tracking with CAQH and PECOS integration';
COMMENT ON TABLE "PayerEnrollmentEvent" IS 'B137A-NCQA-011: Evidence logging for NCQA CR1-CR5 compliance';
COMMENT ON COLUMN "NpiClaim"."caqhProfileId" IS 'B137A-CAQH-003: CAQH ProView profile ID linkage';
COMMENT ON COLUMN "Application"."payerEnrollmentId" IS 'B137A-JOBLINK-012: Link to payer enrollment for plan-specific requirements';

