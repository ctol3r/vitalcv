-- Wave 259: backfill AKG persistence tables required for revocation propagation.

CREATE TABLE IF NOT EXISTS "KnowledgeNode" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeNode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeNode_entityType_entityId_key" UNIQUE ("entityType", "entityId")
);

CREATE INDEX IF NOT EXISTS "KnowledgeNode_entityType_idx" ON "KnowledgeNode"("entityType");
CREATE INDEX IF NOT EXISTS "KnowledgeNode_entityId_idx" ON "KnowledgeNode"("entityId");

CREATE TABLE IF NOT EXISTS "AuthorityEdge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourceNodeId" UUID NOT NULL,
  "targetNodeId" UUID NOT NULL,
  "relationType" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "cryptographicProof" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorityEdge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthorityEdge_sourceNodeId_fkey"
    FOREIGN KEY ("sourceNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuthorityEdge_targetNodeId_fkey"
    FOREIGN KEY ("targetNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuthorityEdge_sourceNodeId_idx" ON "AuthorityEdge"("sourceNodeId");
CREATE INDEX IF NOT EXISTS "AuthorityEdge_targetNodeId_idx" ON "AuthorityEdge"("targetNodeId");
CREATE INDEX IF NOT EXISTS "AuthorityEdge_relationType_idx" ON "AuthorityEdge"("relationType");
CREATE INDEX IF NOT EXISTS "AuthorityEdge_sourceNodeId_relationType_idx"
  ON "AuthorityEdge"("sourceNodeId", "relationType");
