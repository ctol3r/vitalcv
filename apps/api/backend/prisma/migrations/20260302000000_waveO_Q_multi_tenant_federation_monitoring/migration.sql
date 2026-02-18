-- Wave O-Q: Multi-tenant, federation, and monitoring schema updates

CREATE TABLE "Organization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrganizationTrust" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceOrgId" UUID NOT NULL,
    "targetOrgId" UUID NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationTrust_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationTrust_sourceOrgId_idx" ON "OrganizationTrust"("sourceOrgId");
CREATE INDEX "OrganizationTrust_targetOrgId_idx" ON "OrganizationTrust"("targetOrgId");

ALTER TABLE "TrustedIssuer"
  ADD COLUMN "organizationId" UUID;

CREATE INDEX "TrustedIssuer_organizationId_idx" ON "TrustedIssuer"("organizationId");

ALTER TABLE "CredentialTransparencyLog"
  ADD COLUMN "organizationId" UUID;

CREATE INDEX "CredentialTransparencyLog_organizationId_idx" ON "CredentialTransparencyLog"("organizationId");

CREATE TABLE "CredentialMonitoringEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialMonitoringEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CredentialMonitoringEvent_artifactId_idx" ON "CredentialMonitoringEvent"("artifactId");
CREATE INDEX "CredentialMonitoringEvent_organizationId_idx" ON "CredentialMonitoringEvent"("organizationId");
