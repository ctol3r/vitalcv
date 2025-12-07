-- B136A-EHR-001: EHR Integration configuration
-- B136A-TEFCA-006: TEFCA QHIN configuration
-- B136A-LOG-012: Audit log for EHR/TEFCA facade requests
-- Migration: Add EHR and TEFCA integration tables

-- EHR Configuration table
CREATE TABLE IF NOT EXISTS "EhrConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL UNIQUE,
  "ehrType" TEXT NOT NULL CHECK ("ehrType" IN ('epic', 'cerner', 'generic')),
  "fhirBaseUrl" TEXT NOT NULL,
  "authType" TEXT NOT NULL CHECK ("authType" IN ('client_credentials', 'jwt', 'basic')),
  "clientId" TEXT,
  "clientSecret" TEXT,
  "jwtKey" TEXT,
  "metadata" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EhrConfig_orgId_idx" ON "EhrConfig"("orgId");
CREATE INDEX "EhrConfig_isActive_idx" ON "EhrConfig"("isActive");

-- QHIN Configuration table
CREATE TABLE IF NOT EXISTS "QhinConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL UNIQUE,
  "qhinEndpoint" TEXT NOT NULL,
  "allowedPurposes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "orgIdentifier" TEXT NOT NULL,
  "authConfig" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "QhinConfig_orgId_idx" ON "QhinConfig"("orgId");
CREATE INDEX "QhinConfig_isActive_idx" ON "QhinConfig"("isActive");

-- EHR/TEFCA Facade Audit Log table
CREATE TABLE IF NOT EXISTS "EhrFacadeAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "source" TEXT NOT NULL CHECK ("source" IN ('ehr', 'tefca')),
  "resourceType" TEXT NOT NULL,
  "queryHash" TEXT NOT NULL,
  "purposeOfUse" TEXT,
  "statusCode" INTEGER,
  "duration" INTEGER,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EhrFacadeAudit_orgId_idx" ON "EhrFacadeAudit"("orgId");
CREATE INDEX "EhrFacadeAudit_source_idx" ON "EhrFacadeAudit"("source");
CREATE INDEX "EhrFacadeAudit_resourceType_idx" ON "EhrFacadeAudit"("resourceType");
CREATE INDEX "EhrFacadeAudit_createdAt_idx" ON "EhrFacadeAudit"("createdAt");
CREATE INDEX "EhrFacadeAudit_purposeOfUse_idx" ON "EhrFacadeAudit"("purposeOfUse");

COMMENT ON TABLE "EhrConfig" IS 'B136A-EHR-001: Organization-level EHR integration configuration';
COMMENT ON TABLE "QhinConfig" IS 'B136A-TEFCA-006: TEFCA QHIN configuration with Purpose of Use enforcement';
COMMENT ON TABLE "EhrFacadeAudit" IS 'B136A-LOG-012: Audit trail for EHR/TEFCA facade requests';

