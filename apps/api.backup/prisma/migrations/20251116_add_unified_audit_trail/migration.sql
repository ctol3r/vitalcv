-- B239B-COM-011: Add UnifiedAuditTrail model
-- Comprehensive audit trail for compliance tracking

CREATE TABLE IF NOT EXISTS "UnifiedAuditTrail" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "jurisdiction" TEXT,
    "obligationId" TEXT,

    CONSTRAINT "UnifiedAuditTrail_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_entityType_idx" ON "UnifiedAuditTrail"("entityType");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_entityId_idx" ON "UnifiedAuditTrail"("entityId");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_action_idx" ON "UnifiedAuditTrail"("action");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_actorId_idx" ON "UnifiedAuditTrail"("actorId");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_timestamp_idx" ON "UnifiedAuditTrail"("timestamp");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_jurisdiction_idx" ON "UnifiedAuditTrail"("jurisdiction");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_obligationId_idx" ON "UnifiedAuditTrail"("obligationId");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_entityType_entityId_idx" ON "UnifiedAuditTrail"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_timestamp_entityType_idx" ON "UnifiedAuditTrail"("timestamp", "entityType");
CREATE INDEX IF NOT EXISTS "UnifiedAuditTrail_obligationId_timestamp_idx" ON "UnifiedAuditTrail"("obligationId", "timestamp");

