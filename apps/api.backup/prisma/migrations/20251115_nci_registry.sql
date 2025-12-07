-- B200A-NCI: Node registry + trust anchors + verifiable proofs

DO $$
BEGIN
  CREATE TYPE "TrustEntityType" AS ENUM ('ISSUER', 'VERIFIER', 'ORG', 'STATE_BOARD', 'PAYER', 'COMPACT_AUTHORITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AccreditationStatus" AS ENUM ('ACCREDITED', 'PROBATION', 'SUSPENDED', 'REVOKED', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NCINodeType" AS ENUM ('CLINICIAN', 'ISSUER', 'VERIFIER', 'STATE_BOARD', 'PAYER', 'ORG', 'EHR_SYSTEM', 'COMPACT_AUTHORITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NCIVerifiableProofType" AS ENUM ('ISSUANCE', 'VERIFICATION', 'REVOCATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "NCITrustAnchor" (
  "entityId" TEXT PRIMARY KEY,
  "entityType" "TrustEntityType" NOT NULL,
  "publicKey" TEXT NOT NULL,
  "certificateChain" JSONB,
  "accreditation" "AccreditationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "jurisdiction" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NCITrustAnchor_entityType_idx" ON "NCITrustAnchor" ("entityType");
CREATE INDEX IF NOT EXISTS "NCITrustAnchor_jurisdiction_idx" ON "NCITrustAnchor" ("jurisdiction");
CREATE INDEX IF NOT EXISTS "NCITrustAnchor_accreditation_idx" ON "NCITrustAnchor" ("accreditation");
CREATE INDEX IF NOT EXISTS "NCITrustAnchor_isActive_idx" ON "NCITrustAnchor" ("isActive");

CREATE TABLE IF NOT EXISTS "NCINode" (
  "nodeId" TEXT PRIMARY KEY,
  "nodeType" "NCINodeType" NOT NULL,
  "did" TEXT NOT NULL UNIQUE,
  "jurisdiction" TEXT,
  "metadata" JSONB,
  "trustAnchorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NCINode_trustAnchorId_fkey"
    FOREIGN KEY ("trustAnchorId")
    REFERENCES "NCITrustAnchor"("entityId")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NCINode_nodeType_idx" ON "NCINode" ("nodeType");
CREATE INDEX IF NOT EXISTS "NCINode_jurisdiction_idx" ON "NCINode" ("jurisdiction");
CREATE INDEX IF NOT EXISTS "NCINode_trustAnchorId_idx" ON "NCINode" ("trustAnchorId");

CREATE TABLE IF NOT EXISTS "NCIVerifiableProof" (
  "id" TEXT PRIMARY KEY,
  "did" TEXT NOT NULL,
  "proofType" "NCIVerifiableProofType" NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "anchorTxHash" TEXT,
  "chainId" TEXT,
  "metadata" JSONB,
  "issuedFor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NCIVerifiableProof_did_fkey"
    FOREIGN KEY ("did")
    REFERENCES "NCINode"("did")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NCIVerifiableProof_payloadHash_proofType_key"
  ON "NCIVerifiableProof" ("payloadHash", "proofType");
CREATE INDEX IF NOT EXISTS "NCIVerifiableProof_did_idx" ON "NCIVerifiableProof" ("did");
CREATE INDEX IF NOT EXISTS "NCIVerifiableProof_proofType_idx" ON "NCIVerifiableProof" ("proofType");
CREATE INDEX IF NOT EXISTS "NCIVerifiableProof_eventType_idx" ON "NCIVerifiableProof" ("eventType");
CREATE INDEX IF NOT EXISTS "NCIVerifiableProof_issuedFor_idx" ON "NCIVerifiableProof" ("issuedFor");
