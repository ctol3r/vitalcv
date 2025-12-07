-- S72-POST-3A-001: Add PilotOrg metadata model
-- S72-POST-3A-003: Add PilotUnit model
-- S72-POST-3A-004: Wire JobPosting to optional PilotUnit

-- Create PilotUnitType enum
CREATE TYPE "PilotUnitType" AS ENUM ('CLINIC', 'SERVICE_LINE', 'DEPT');

-- Create PilotOrg table
CREATE TABLE IF NOT EXISTS "PilotOrg" (
    "id" TEXT NOT NULL,
    "pilotName" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "sponsorEmail" TEXT NOT NULL,
    "ehrType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotOrg_pkey" PRIMARY KEY ("id")
);

-- Create PilotUnit table
CREATE TABLE IF NOT EXISTS "PilotUnit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PilotUnitType" NOT NULL,
    "ehrCostCenterCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotUnit_pkey" PRIMARY KEY ("id")
);

-- Add pilotUnitId to JobPosting
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "pilotUnitId" TEXT;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PilotOrg_pilotName_key" ON "PilotOrg"("pilotName");
CREATE INDEX IF NOT EXISTS "PilotOrg_pilotName_idx" ON "PilotOrg"("pilotName");
CREATE INDEX IF NOT EXISTS "PilotUnit_orgId_idx" ON "PilotUnit"("orgId");
CREATE INDEX IF NOT EXISTS "PilotUnit_type_idx" ON "PilotUnit"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "PilotUnit_orgId_name_key" ON "PilotUnit"("orgId", "name");
CREATE INDEX IF NOT EXISTS "JobPosting_pilotUnitId_idx" ON "JobPosting"("pilotUnitId");

-- Add foreign key constraints
ALTER TABLE "PilotUnit" ADD CONSTRAINT "PilotUnit_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "PilotOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_pilotUnitId_fkey"
    FOREIGN KEY ("pilotUnitId") REFERENCES "PilotUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

