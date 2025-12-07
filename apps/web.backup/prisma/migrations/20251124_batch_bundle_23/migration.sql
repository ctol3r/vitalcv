CREATE TABLE IF NOT EXISTS "RecruiterNote" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "recruiterId" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruiterNote_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecruiterNote_clinician_created_idx"
  ON "RecruiterNote" ("clinicianId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecruiterNote_recruiter_created_idx"
  ON "RecruiterNote" ("recruiterId", "createdAt");

CREATE TABLE IF NOT EXISTS "RecruiterContactEvent" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "clinicianId" TEXT NOT NULL,
  "recruiterId" TEXT NOT NULL,
  "channel" TEXT,
  "metadata" JSONB,
  "contactedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruiterContactEvent_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecruiterContactEvent_clinician_contact_idx"
  ON "RecruiterContactEvent" ("clinicianId", "contactedAt" DESC);

CREATE INDEX IF NOT EXISTS "RecruiterContactEvent_recruiter_contact_idx"
  ON "RecruiterContactEvent" ("recruiterId", "contactedAt" DESC);

CREATE TABLE IF NOT EXISTS "WorkforceTrend" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "specialty" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "signals" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "predicted" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "WorkforceTrend_specialty_region_idx"
  ON "WorkforceTrend" ("specialty", "region");

CREATE INDEX IF NOT EXISTS "WorkforceTrend_created_idx"
  ON "WorkforceTrend" ("createdAt");

CREATE TABLE IF NOT EXISTS "CompactDocument" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "clinicianId" TEXT NOT NULL,
  "compact" TEXT NOT NULL,
  "documentUrl" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompactDocument_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CompactDocument_clinician_compact_idx"
  ON "CompactDocument" ("clinicianId", "compact");

CREATE INDEX IF NOT EXISTS "CompactDocument_verified_idx"
  ON "CompactDocument" ("verified");










