-- Workforce demand graph primitives (B199B-WORK-006..010)

CREATE TYPE "WorkforceDemandNodeType" AS ENUM ('DEPARTMENT', 'SHIFT', 'ROLE', 'SERVICE', 'REQUIREMENT');
CREATE TYPE "WorkforceDemandUrgency" AS ENUM ('FLEXIBLE', 'ROUTINE', 'PRIORITY', 'CRITICAL');

CREATE TABLE IF NOT EXISTS "WorkforceDemandNode" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "nodeType" "WorkforceDemandNodeType" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "parentNodeId" TEXT,
  "capacity" INTEGER,
  "headcountTarget" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "constraints" JSONB,
  "priorityScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceDemandNode_parent_fk"
    FOREIGN KEY ("parentNodeId") REFERENCES "WorkforceDemandNode"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkforceDemandNode_org_type_label_idx"
  ON "WorkforceDemandNode" ("orgId", "nodeType", "label");
CREATE INDEX IF NOT EXISTS "WorkforceDemandNode_org_type_idx"
  ON "WorkforceDemandNode" ("orgId", "nodeType");
CREATE INDEX IF NOT EXISTS "WorkforceDemandNode_parent_idx"
  ON "WorkforceDemandNode" ("parentNodeId");

CREATE TABLE IF NOT EXISTS "WorkforceDemand" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "deptId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "privilegeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredCompacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredEnrollments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredEhrCompetencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "shiftStart" TIMESTAMP(3) NOT NULL,
  "shiftEnd" TIMESTAMP(3) NOT NULL,
  "shiftTimezone" TEXT,
  "location" JSONB,
  "urgency" "WorkforceDemandUrgency" NOT NULL DEFAULT 'ROUTINE',
  "requiredHeadcount" INTEGER NOT NULL DEFAULT 1,
  "fulfilledHeadcount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceDemand_dept_fk"
    FOREIGN KEY ("deptId") REFERENCES "WorkforceDemandNode"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkforceDemand_org_dept_idx"
  ON "WorkforceDemand" ("orgId", "deptId");
CREATE INDEX IF NOT EXISTS "WorkforceDemand_urgency_idx"
  ON "WorkforceDemand" ("urgency");
CREATE INDEX IF NOT EXISTS "WorkforceDemand_shiftStart_idx"
  ON "WorkforceDemand" ("shiftStart");


