-- B209A-STRAT-001: CreateOrgStrategicState table
-- B209A-STRAT-003: CreateOrgOperationalProfile table

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrgStrategicState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workforceReadinessIndex" DOUBLE PRECISION,
    "credentialRiskIndex" DOUBLE PRECISION,
    "privilegeCapacityIndex" DOUBLE PRECISION,
    "safetyIndex" DOUBLE PRECISION,
    "enrollmentStabilityIndex" DOUBLE PRECISION,
    "demandForecastIndex" DOUBLE PRECISION,
    "competencyDistribution" JSONB,
    "departmentStability" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgStrategicState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrgOperationalProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "volumes" JSONB,
    "ehrType" TEXT,
    "geographicCompacts" JSONB,
    "payerMix" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgOperationalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgStrategicState_orgId_idx" ON "OrgStrategicState"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgStrategicState_timestamp_idx" ON "OrgStrategicState"("timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgStrategicState_orgId_timestamp_idx" ON "OrgStrategicState"("orgId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrgOperationalProfile_orgId_key" ON "OrgOperationalProfile"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgOperationalProfile_orgId_idx" ON "OrgOperationalProfile"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgOperationalProfile_ehrType_idx" ON "OrgOperationalProfile"("ehrType");

