-- B165C-SSO-001: SsoProvider model for org-level OIDC configuration
CREATE TABLE IF NOT EXISTS "SsoProvider" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecretKey" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "domainWhitelist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "autoProvisionRole" "OrgMembershipRole" NOT NULL DEFAULT 'REVIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SsoProvider_orgId_key" ON "SsoProvider"("orgId");
CREATE INDEX IF NOT EXISTS "SsoProvider_issuer_idx" ON "SsoProvider"("issuer");

ALTER TABLE "SsoProvider"
  ADD CONSTRAINT "SsoProvider_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "OrgProfile"("orgId") ON DELETE CASCADE;
