-- B209A-STRAT-001, B209A-STRAT-003: OrgStrategicState and OrgOperationalProfile models
-- Organization-level strategic metrics and operational parameters

-- OrgStrategicState: Organization-level strategic metrics
CREATE TABLE IF NOT EXISTS "OrgStrategicState" (
  "id" TEXT PRIMARY KEY NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrgStrategicState_orgId_idx" ON "OrgStrategicState"("orgId");
CREATE INDEX IF NOT EXISTS "OrgStrategicState_timestamp_idx" ON "OrgStrategicState"("timestamp");
CREATE INDEX IF NOT EXISTS "OrgStrategicState_orgId_timestamp_idx" ON "OrgStrategicState"("orgId", "timestamp");

-- OrgOperationalProfile: Organization-specific operational parameters
CREATE TABLE IF NOT EXISTS "OrgOperationalProfile" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL UNIQUE,
  "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "volumes" JSONB,
  "ehrType" TEXT,
  "geographicCompacts" JSONB,
  "payerMix" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrgOperationalProfile_orgId_idx" ON "OrgOperationalProfile"("orgId");
CREATE INDEX IF NOT EXISTS "OrgOperationalProfile_ehrType_idx" ON "OrgOperationalProfile"("ehrType");

