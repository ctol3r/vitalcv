-- B170A-PRIV: PrivilegeMatrix + PrivilegeSet v2 schema

ALTER TABLE "PrivilegeRequest"
  ADD COLUMN IF NOT EXISTS "privilegeSetV2Id" TEXT;

CREATE TABLE IF NOT EXISTS "PrivilegeMatrix" (
  "id" TEXT PRIMARY KEY,
  "specialty" TEXT NOT NULL,
  "privilegeCode" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "prerequisites" JSONB NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PrivilegeMatrix_specialty_idx" ON "PrivilegeMatrix"("specialty");
CREATE INDEX IF NOT EXISTS "PrivilegeMatrix_isActive_idx" ON "PrivilegeMatrix"("isActive");

CREATE TABLE IF NOT EXISTS "PrivilegeSetV2" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrivilegeSetV2_orgId_name_key" ON "PrivilegeSetV2"("orgId","name");
CREATE INDEX IF NOT EXISTS "PrivilegeSetV2_orgId_idx" ON "PrivilegeSetV2"("orgId");
CREATE INDEX IF NOT EXISTS "PrivilegeSetV2_specialty_idx" ON "PrivilegeSetV2"("specialty");
CREATE INDEX IF NOT EXISTS "PrivilegeSetV2_isActive_idx" ON "PrivilegeSetV2"("isActive");

CREATE TABLE IF NOT EXISTS "PrivilegeSetV2Privilege" (
  "id" TEXT PRIMARY KEY,
  "privilegeSetV2Id" TEXT NOT NULL,
  "privilegeMatrixId" TEXT NOT NULL,
  "privilegeCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivilegeSetV2Privilege_set_matrix_unique" UNIQUE ("privilegeSetV2Id","privilegeMatrixId"),
  CONSTRAINT "PrivilegeSetV2Privilege_privilegeSetV2Id_fkey" FOREIGN KEY ("privilegeSetV2Id") REFERENCES "PrivilegeSetV2"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivilegeSetV2Privilege_privilegeMatrixId_fkey" FOREIGN KEY ("privilegeMatrixId") REFERENCES "PrivilegeMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PrivilegeSetV2Privilege_code_idx" ON "PrivilegeSetV2Privilege"("privilegeCode");

ALTER TABLE "PrivilegeRequest"
  ADD CONSTRAINT IF NOT EXISTS "PrivilegeRequest_privilegeSetV2Id_fkey"
  FOREIGN KEY ("privilegeSetV2Id") REFERENCES "PrivilegeSetV2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PrivilegeRequest_privilegeSetV2Id_idx" ON "PrivilegeRequest"("privilegeSetV2Id");

