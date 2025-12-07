-- Ensure JobPosting table exists (hotfix)
CREATE TABLE IF NOT EXISTS "JobPosting" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "description" TEXT,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- B138A-IMLC-001: Create IMLCEligibility table
CREATE TABLE "IMLCEligibility" (
    "id" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "homeState" TEXT NOT NULL,
    "compactStates" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "licenseHistory" JSONB,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IMLCEligibility_pkey" PRIMARY KEY ("id")
);

-- B138A-PSY-004: Create PSYPACTCompact table
CREATE TABLE "PSYPACTCompact" (
    "id" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "participatingStates" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "ePassportId" TEXT,
    "primaryState" TEXT,
    "licenseData" JSONB,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PSYPACTCompact_pkey" PRIMARY KEY ("id")
);

-- B138A-CC-006: Create CounselingCompact table
CREATE TABLE "CounselingCompact" (
    "id" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "homeState" TEXT,
    "compactStates" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "licenseType" TEXT,
    "licenseData" JSONB,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounselingCompact_pkey" PRIMARY KEY ("id")
);

-- B138A-COMPACT-008: Create CompactsStatus table
CREATE TABLE "CompactsStatus" (
    "id" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "imlcStatus" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "imlcHomeState" TEXT,
    "imlcCompactStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "psypactStatus" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "psypactStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "counselingStatus" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "counselingHomeState" TEXT,
    "counselingStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRefreshAt" TIMESTAMP(3),
    "vcHash" TEXT,
    "vcCredentialId" TEXT,
    "anchoredTxHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompactsStatus_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "IMLCEligibility_clinicianDid_key" ON "IMLCEligibility"("clinicianDid");
CREATE UNIQUE INDEX "PSYPACTCompact_clinicianDid_key" ON "PSYPACTCompact"("clinicianDid");
CREATE UNIQUE INDEX "CounselingCompact_clinicianDid_key" ON "CounselingCompact"("clinicianDid");
CREATE UNIQUE INDEX "CompactsStatus_clinicianDid_key" ON "CompactsStatus"("clinicianDid");

-- Create indexes for performance
CREATE INDEX "IMLCEligibility_clinicianDid_idx" ON "IMLCEligibility"("clinicianDid");
CREATE INDEX "IMLCEligibility_homeState_idx" ON "IMLCEligibility"("homeState");
CREATE INDEX "IMLCEligibility_status_idx" ON "IMLCEligibility"("status");
CREATE INDEX "IMLCEligibility_lastCheckedAt_idx" ON "IMLCEligibility"("lastCheckedAt");

CREATE INDEX "PSYPACTCompact_clinicianDid_idx" ON "PSYPACTCompact"("clinicianDid");
CREATE INDEX "PSYPACTCompact_status_idx" ON "PSYPACTCompact"("status");
CREATE INDEX "PSYPACTCompact_ePassportId_idx" ON "PSYPACTCompact"("ePassportId");
CREATE INDEX "PSYPACTCompact_primaryState_idx" ON "PSYPACTCompact"("primaryState");
CREATE INDEX "PSYPACTCompact_lastCheckedAt_idx" ON "PSYPACTCompact"("lastCheckedAt");

CREATE INDEX "CounselingCompact_clinicianDid_idx" ON "CounselingCompact"("clinicianDid");
CREATE INDEX "CounselingCompact_homeState_idx" ON "CounselingCompact"("homeState");
CREATE INDEX "CounselingCompact_status_idx" ON "CounselingCompact"("status");
CREATE INDEX "CounselingCompact_lastCheckedAt_idx" ON "CounselingCompact"("lastCheckedAt");

CREATE INDEX "CompactsStatus_clinicianDid_idx" ON "CompactsStatus"("clinicianDid");
CREATE INDEX "CompactsStatus_imlcStatus_idx" ON "CompactsStatus"("imlcStatus");
CREATE INDEX "CompactsStatus_psypactStatus_idx" ON "CompactsStatus"("psypactStatus");
CREATE INDEX "CompactsStatus_counselingStatus_idx" ON "CompactsStatus"("counselingStatus");
CREATE INDEX "CompactsStatus_lastComputedAt_idx" ON "CompactsStatus"("lastComputedAt");
CREATE INDEX "CompactsStatus_nextRefreshAt_idx" ON "CompactsStatus"("nextRefreshAt");

-- B138A-JOBS-010: Add compact support fields to JobPosting
ALTER TABLE "JobPosting" ADD COLUMN "targetLicenseJurisdictions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobPosting" ADD COLUMN "imlcAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobPosting" ADD COLUMN "psypactAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobPosting" ADD COLUMN "counselingCompactAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobPosting" ADD COLUMN "compactAllowed" BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for job matching
CREATE INDEX "JobPosting_imlcAllowed_idx" ON "JobPosting"("imlcAllowed");
CREATE INDEX "JobPosting_psypactAllowed_idx" ON "JobPosting"("psypactAllowed");
CREATE INDEX "JobPosting_counselingCompactAllowed_idx" ON "JobPosting"("counselingCompactAllowed");
CREATE INDEX "JobPosting_compactAllowed_idx" ON "JobPosting"("compactAllowed");
