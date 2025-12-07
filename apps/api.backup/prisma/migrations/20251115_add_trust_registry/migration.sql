-- B190B-TRUST-006: Introduce TrustRegistry model with enums
CREATE TYPE "TrustEntityType" AS ENUM (
  'ISSUER',
  'VERIFIER',
  'ORG',
  'STATE_BOARD',
  'PAYER',
  'COMPACT_AUTHORITY'
);

CREATE TYPE "AccreditationStatus" AS ENUM (
  'ACCREDITED',
  'PROBATION',
  'SUSPENDED',
  'REVOKED',
  'UNKNOWN'
);

CREATE TABLE "TrustRegistry" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityType" "TrustEntityType" NOT NULL,
  "did" TEXT NOT NULL,
  "publicKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "jurisdiction" TEXT,
  "accreditationStatus" "AccreditationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustRegistry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustRegistry_entityId_entityType_key"
  ON "TrustRegistry" ("entityId", "entityType");
CREATE UNIQUE INDEX "TrustRegistry_did_key" ON "TrustRegistry" ("did");
CREATE INDEX "TrustRegistry_entityType_idx" ON "TrustRegistry" ("entityType");
CREATE INDEX "TrustRegistry_jurisdiction_idx" ON "TrustRegistry" ("jurisdiction");
CREATE INDEX "TrustRegistry_accreditationStatus_idx"
  ON "TrustRegistry" ("accreditationStatus");

