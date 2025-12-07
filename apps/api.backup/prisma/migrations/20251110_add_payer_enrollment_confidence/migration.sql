-- Ensure PayerEnrollment table exists (hotfix)
CREATE TABLE IF NOT EXISTS "PayerEnrollment" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT,
  "payerId" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- B212A-ENROLL-001: Add confidenceScore and failureReason to PayerEnrollment
-- Migration to extend PayerEnrollment model with confidence scoring and failure classification

-- Add confidenceScore column (0-1 float)
ALTER TABLE "PayerEnrollment" ADD COLUMN "confidenceScore" DOUBLE PRECISION;

-- Add failureReason column (enum: MISSING_DOCS, REJECTED, PENDING_REVIEW, PAYER_PANEL_FULL)
ALTER TABLE "PayerEnrollment" ADD COLUMN "failureReason" TEXT;

-- Add index on confidenceScore for filtering/sorting
CREATE INDEX "PayerEnrollment_confidenceScore_idx" ON "PayerEnrollment"("confidenceScore");

-- Add index on failureReason for filtering
CREATE INDEX "PayerEnrollment_failureReason_idx" ON "PayerEnrollment"("failureReason");

-- Add check constraint to ensure confidenceScore is between 0 and 1
ALTER TABLE "PayerEnrollment" ADD CONSTRAINT "PayerEnrollment_confidenceScore_check"
  CHECK ("confidenceScore" IS NULL OR ("confidenceScore" >= 0 AND "confidenceScore" <= 1));

-- Add check constraint to ensure failureReason is one of the allowed values
ALTER TABLE "PayerEnrollment" ADD CONSTRAINT "PayerEnrollment_failureReason_check"
  CHECK ("failureReason" IS NULL OR "failureReason" IN ('MISSING_DOCS', 'REJECTED', 'PENDING_REVIEW', 'PAYER_PANEL_FULL'));

COMMENT ON COLUMN "PayerEnrollment"."confidenceScore" IS 'B212A-ENROLL-001: Confidence score (0-1) for enrollment status';
COMMENT ON COLUMN "PayerEnrollment"."failureReason" IS 'B212A-ENROLL-001: Failure reason: MISSING_DOCS, REJECTED, PENDING_REVIEW, PAYER_PANEL_FULL';
