-- Task 131.1: AuditProof store

CREATE TABLE IF NOT EXISTS "AuditProof" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "circuitType" TEXT NOT NULL,
  "proof" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuditProof_event_idx"
  ON "AuditProof" ("eventId");

CREATE INDEX IF NOT EXISTS "AuditProof_circuit_idx"
  ON "AuditProof" ("circuitType");


