-- Wave 32: Verifier Onboarding Protocol
-- Adds VerifierOrg, VerifierAccessToken, and org context columns

-- VerifierOrg: enterprise verifier registration
CREATE TABLE "VerifierOrg" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pilotActivated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VerifierOrg_pkey" PRIMARY KEY ("id")
);

-- VerifierAccessToken: time-bound access tokens for verifier activation
CREATE TABLE "VerifierAccessToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verifierOrgId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifierAccessToken_pkey" PRIMARY KEY ("id")
);

-- Indexes for VerifierOrg
CREATE INDEX "VerifierOrg_contactEmail_idx" ON "VerifierOrg"("contactEmail");
CREATE INDEX "VerifierOrg_pilotActivated_idx" ON "VerifierOrg"("pilotActivated");
CREATE INDEX "VerifierOrg_createdAt_idx" ON "VerifierOrg"("createdAt");

-- Indexes for VerifierAccessToken
CREATE UNIQUE INDEX "VerifierAccessToken_token_key" ON "VerifierAccessToken"("token");
CREATE INDEX "VerifierAccessToken_verifierOrgId_idx" ON "VerifierAccessToken"("verifierOrgId");
CREATE INDEX "VerifierAccessToken_token_idx" ON "VerifierAccessToken"("token");
CREATE INDEX "VerifierAccessToken_expiresAt_idx" ON "VerifierAccessToken"("expiresAt");

-- Foreign key: VerifierAccessToken → VerifierOrg
ALTER TABLE "VerifierAccessToken"
    ADD CONSTRAINT "VerifierAccessToken_verifierOrgId_fkey"
    FOREIGN KEY ("verifierOrgId") REFERENCES "VerifierOrg"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Org context propagation: add organizationId to ShareLink
ALTER TABLE "ShareLink" ADD COLUMN "organizationId" UUID;
CREATE INDEX "ShareLink_organizationId_idx" ON "ShareLink"("organizationId");

-- Org context propagation: add organizationId to AuditEvent
ALTER TABLE "AuditEvent" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");
