-- Task 124.1: IdentityForensics persistence

CREATE TABLE IF NOT EXISTS "IdentityForensics" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "riskScore" DOUBLE PRECISION NOT NULL,
  "signals" JSONB NOT NULL,
  "lastReviewed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityForensics_clinicianId_fkey"
    FOREIGN KEY ("clinicianId")
    REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IdentityForensics_clinician_reviewed_idx"
  ON "IdentityForensics" ("clinicianId", "lastReviewed");

CREATE INDEX IF NOT EXISTS "IdentityForensics_risk_idx"
  ON "IdentityForensics" ("riskScore");










