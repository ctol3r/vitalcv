-- S72-POST-3B-001: Add GapTicket model for tracking gaps/technical debt

-- Create GapTicketStatus enum
CREATE TYPE "GapTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- Create GapTicketSeverity enum
CREATE TYPE "GapTicketSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Create GapTicket table
CREATE TABLE IF NOT EXISTS "GapTicket" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "severity" "GapTicketSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GapTicketStatus" NOT NULL DEFAULT 'OPEN',
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "GapTicket_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "GapTicket_area_idx" ON "GapTicket"("area");
CREATE INDEX IF NOT EXISTS "GapTicket_severity_idx" ON "GapTicket"("severity");
CREATE INDEX IF NOT EXISTS "GapTicket_status_idx" ON "GapTicket"("status");
CREATE INDEX IF NOT EXISTS "GapTicket_createdAt_idx" ON "GapTicket"("createdAt");
CREATE INDEX IF NOT EXISTS "GapTicket_area_status_idx" ON "GapTicket"("area", "status");

