-- Migration: Add OID4VP tables (DC-001, DC-003, DC-004, DC-015)
-- Run this migration after updating the Prisma schema

-- PresentationDefinition table
CREATE TABLE IF NOT EXISTS "PresentationDefinition" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "name" TEXT,
  "json" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PresentationDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PresentationDefinition_orgId_idx" ON "PresentationDefinition"("orgId");
CREATE INDEX IF NOT EXISTS "PresentationDefinition_createdAt_idx" ON "PresentationDefinition"("createdAt");

-- VerifierSession table
CREATE TABLE IF NOT EXISTS "VerifierSession" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "nonce" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "presentationDefinitionId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "vpToken" TEXT,
  "verificationResult" JSONB,
  "candidateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifierSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerifierSession_nonce_key" UNIQUE ("nonce"),
  CONSTRAINT "VerifierSession_state_key" UNIQUE ("state")
);

CREATE INDEX IF NOT EXISTS "VerifierSession_nonce_idx" ON "VerifierSession"("nonce");
CREATE INDEX IF NOT EXISTS "VerifierSession_state_idx" ON "VerifierSession"("state");
CREATE INDEX IF NOT EXISTS "VerifierSession_orgId_idx" ON "VerifierSession"("orgId");
CREATE INDEX IF NOT EXISTS "VerifierSession_status_idx" ON "VerifierSession"("status");
CREATE INDEX IF NOT EXISTS "VerifierSession_expiresAt_idx" ON "VerifierSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "VerifierSession_presentationDefinitionId_idx" ON "VerifierSession"("presentationDefinitionId");
CREATE INDEX IF NOT EXISTS "VerifierSession_candidateId_idx" ON "VerifierSession"("candidateId");

-- Candidate table
CREATE TABLE IF NOT EXISTS "Candidate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "npi" TEXT,
  "did" TEXT,
  "email" TEXT,
  "name" TEXT,
  "verifiedData" JSONB,
  "classification" JSONB,
  "erasedAt" TIMESTAMP(3),
  "encryptionKeyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Candidate_orgId_npi_key" UNIQUE ("orgId", "npi"),
  CONSTRAINT "Candidate_orgId_did_key" UNIQUE ("orgId", "did")
);

CREATE INDEX IF NOT EXISTS "Candidate_orgId_idx" ON "Candidate"("orgId");
CREATE INDEX IF NOT EXISTS "Candidate_npi_idx" ON "Candidate"("npi");
CREATE INDEX IF NOT EXISTS "Candidate_did_idx" ON "Candidate"("did");
CREATE INDEX IF NOT EXISTS "Candidate_erasedAt_idx" ON "Candidate"("erasedAt");

-- Foreign key constraints
ALTER TABLE "PresentationDefinition" ADD CONSTRAINT "PresentationDefinition_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerifierSession" ADD CONSTRAINT "VerifierSession_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerifierSession" ADD CONSTRAINT "VerifierSession_presentationDefinitionId_fkey"
  FOREIGN KEY ("presentationDefinitionId") REFERENCES "PresentationDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VerifierSession" ADD CONSTRAINT "VerifierSession_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

