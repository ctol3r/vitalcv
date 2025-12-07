-- B185A-PECOS-001: Introduce PECOSEnrollment lifecycle table
CREATE TABLE "PECOSEnrollment" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "enrollmentType" TEXT NOT NULL,
  "statuses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "currentStatus" TEXT NOT NULL,
  "lastCheckedAt" TIMESTAMP(3),
  "revalidationDueAt" TIMESTAMP(3),
  "anomalies" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PECOSEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PECOSEnrollment_clinicianId_enrollmentType_key"
  ON "PECOSEnrollment" ("clinicianId", "enrollmentType");
CREATE INDEX "PECOSEnrollment_clinicianId_idx" ON "PECOSEnrollment" ("clinicianId");
CREATE INDEX "PECOSEnrollment_enrollmentType_idx" ON "PECOSEnrollment" ("enrollmentType");
CREATE INDEX "PECOSEnrollment_currentStatus_idx" ON "PECOSEnrollment" ("currentStatus");
CREATE INDEX "PECOSEnrollment_lastCheckedAt_idx" ON "PECOSEnrollment" ("lastCheckedAt");
CREATE INDEX "PECOSEnrollment_revalidationDueAt_idx" ON "PECOSEnrollment" ("revalidationDueAt");
