-- Wave 199: SD-JWT issuer persistence

CREATE TYPE "IssuerSigningKeyState" AS ENUM ('ACTIVE', 'GRACE', 'RETIRED');

ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "anchored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "merkleRoot" TEXT;

CREATE INDEX IF NOT EXISTS "AuditEvent_anchored_idx" ON "AuditEvent"("anchored");
CREATE INDEX IF NOT EXISTS "AuditEvent_merkleRoot_idx" ON "AuditEvent"("merkleRoot");

CREATE TABLE "IssuerSigningKey" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "issuerDid" TEXT NOT NULL,
  "kid" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL,
  "publicKeyJwk" JSONB NOT NULL,
  "encryptedPrivateKeyJwk" TEXT NOT NULL,
  "state" "IssuerSigningKeyState" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatesAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "graceUntil" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "rotatedFromKid" TEXT,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "IssuerSigningKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IssuerSigningKey_kid_key" UNIQUE ("kid")
);

CREATE INDEX "IssuerSigningKey_issuerDid_state_idx" ON "IssuerSigningKey"("issuerDid", "state");
CREATE INDEX "IssuerSigningKey_issuerDid_activatesAt_idx" ON "IssuerSigningKey"("issuerDid", "activatesAt");
CREATE INDEX "IssuerSigningKey_graceUntil_idx" ON "IssuerSigningKey"("graceUntil");
CREATE INDEX "IssuerSigningKey_rotatedFromKid_idx" ON "IssuerSigningKey"("rotatedFromKid");

CREATE TABLE "IssuedCredentialRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "credentialId" TEXT NOT NULL,
  "issuerDid" TEXT NOT NULL,
  "holderDid" TEXT NOT NULL,
  "credentialType" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "kid" TEXT NOT NULL,
  "claimDigests" JSONB NOT NULL,
  "disclosureDigests" TEXT[] NOT NULL DEFAULT '{}',
  "holderBindingHash" TEXT NOT NULL,
  "statusReference" TEXT,
  "receiptId" TEXT NOT NULL,
  "auditEventId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssuedCredentialRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IssuedCredentialRecord_credentialId_key" UNIQUE ("credentialId"),
  CONSTRAINT "IssuedCredentialRecord_receiptId_key" UNIQUE ("receiptId"),
  CONSTRAINT "IssuedCredentialRecord_auditEventId_key" UNIQUE ("auditEventId")
);

CREATE INDEX "IssuedCredentialRecord_issuerDid_createdAt_idx" ON "IssuedCredentialRecord"("issuerDid", "createdAt");
CREATE INDEX "IssuedCredentialRecord_holderDid_createdAt_idx" ON "IssuedCredentialRecord"("holderDid", "createdAt");
CREATE INDEX "IssuedCredentialRecord_kid_idx" ON "IssuedCredentialRecord"("kid");
CREATE INDEX "IssuedCredentialRecord_status_idx" ON "IssuedCredentialRecord"("status");
CREATE INDEX "IssuedCredentialRecord_revokedAt_idx" ON "IssuedCredentialRecord"("revokedAt");
