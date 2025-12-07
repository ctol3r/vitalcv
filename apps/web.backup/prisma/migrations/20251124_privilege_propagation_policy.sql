-- Privilege propagation policy table for multi-site auto-alignment (Batch 65.1)

CREATE TABLE IF NOT EXISTS "PrivilegePropagationPolicy" (
  "id" TEXT PRIMARY KEY,
  "systemId" TEXT NOT NULL,
  "sites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "propagate" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PrivilegePropagationPolicy_system_idx"
  ON "PrivilegePropagationPolicy" ("systemId");











