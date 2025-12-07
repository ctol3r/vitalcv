-- B193A-PRIVDEP: Privilege dependency graph primitives

CREATE TYPE "PrivilegeCategory" AS ENUM ('surgical', 'procedural', 'diagnostic', 'admin');
CREATE TYPE "PrivilegeDependencyType" AS ENUM ('REQUIRES', 'ENHANCES', 'CONFLICTS_WITH', 'MUTUALLY_EXCLUSIVE');

CREATE TABLE IF NOT EXISTS "PrivilegeNode" (
  "id" TEXT PRIMARY KEY,
  "privilegeCode" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" "PrivilegeCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PrivilegeNode_specialty_idx" ON "PrivilegeNode" ("specialty");
CREATE INDEX IF NOT EXISTS "PrivilegeNode_category_idx" ON "PrivilegeNode" ("category");
CREATE INDEX IF NOT EXISTS "PrivilegeNode_createdAt_idx" ON "PrivilegeNode" ("createdAt");

CREATE TABLE IF NOT EXISTS "PrivilegeDependency" (
  "id" TEXT PRIMARY KEY,
  "parentPrivilegeId" TEXT NOT NULL,
  "childPrivilegeId" TEXT NOT NULL,
  "dependencyType" "PrivilegeDependencyType" NOT NULL,
  "rationale" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivilegeDependency_parent_fk"
    FOREIGN KEY ("parentPrivilegeId") REFERENCES "PrivilegeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivilegeDependency_child_fk"
    FOREIGN KEY ("childPrivilegeId") REFERENCES "PrivilegeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivilegeDependency_unique_edge"
    UNIQUE ("parentPrivilegeId", "childPrivilegeId", "dependencyType")
);

CREATE INDEX IF NOT EXISTS "PrivilegeDependency_child_idx" ON "PrivilegeDependency" ("childPrivilegeId");
CREATE INDEX IF NOT EXISTS "PrivilegeDependency_type_idx" ON "PrivilegeDependency" ("dependencyType");

