-- B181A-WALLET: WalletDevice + WalletCredential primitives
-- Stores registered wallet devices & issued credentials tied to clinician profile

CREATE TABLE IF NOT EXISTS "WalletDevice" (
  "deviceId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicianId" TEXT NOT NULL,
  "publicKeyJwk" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "WalletDevice_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WalletDevice_clinicianId_idx"
  ON "WalletDevice"("clinicianId");

CREATE TABLE IF NOT EXISTS "WalletCredential" (
  "credentialId" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletCredential_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WalletCredential_clinicianId_idx"
  ON "WalletCredential"("clinicianId");

CREATE INDEX IF NOT EXISTS "WalletCredential_revokedAt_idx"
  ON "WalletCredential"("revokedAt");

