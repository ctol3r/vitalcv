-- B170A-PRIV: PrivilegeMatrix + PrivilegeSet v2 schema

ALTER TABLE "PrivilegeRequest"
  ADD COLUMN IF NOT EXISTS "privilegeSetV2Id" TEXT;

CREATE TABLE "PrivilegeMatrix" (
    "id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "privilegeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prerequisites" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegeMatrix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivilegeMatrix_privilegeCode_key" ON "PrivilegeMatrix"("privilegeCode");
CREATE INDEX "PrivilegeMatrix_specialty_idx" ON "PrivilegeMatrix"("specialty");
CREATE INDEX "PrivilegeMatrix_isActive_idx" ON "PrivilegeMatrix"("isActive");

CREATE TABLE "PrivilegeSetV2" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegeSetV2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivilegeSetV2_orgId_name_key" ON "PrivilegeSetV2"("orgId", "name");
CREATE INDEX "PrivilegeSetV2_orgId_idx" ON "PrivilegeSetV2"("orgId");
CREATE INDEX "PrivilegeSetV2_specialty_idx" ON "PrivilegeSetV2"("specialty");
CREATE INDEX "PrivilegeSetV2_isActive_idx" ON "PrivilegeSetV2"("isActive");

CREATE TABLE "PrivilegeSetV2Privilege" (
    "id" TEXT NOT NULL,
    "privilegeSetV2Id" TEXT NOT NULL,
    "privilegeMatrixId" TEXT NOT NULL,
    "privilegeCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegeSetV2Privilege_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivilegeSetV2Privilege_set_matrix_key" ON "PrivilegeSetV2Privilege"("privilegeSetV2Id", "privilegeMatrixId");
CREATE INDEX "PrivilegeSetV2Privilege_privilegeCode_idx" ON "PrivilegeSetV2Privilege"("privilegeCode");

ALTER TABLE "PrivilegeSetV2Privilege"
  ADD CONSTRAINT "PrivilegeSetV2Privilege_privilegeSetV2Id_fkey"
  FOREIGN KEY ("privilegeSetV2Id") REFERENCES "PrivilegeSetV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrivilegeSetV2Privilege"
  ADD CONSTRAINT "PrivilegeSetV2Privilege_privilegeMatrixId_fkey"
  FOREIGN KEY ("privilegeMatrixId") REFERENCES "PrivilegeMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivilegeRequest"
  ADD CONSTRAINT "PrivilegeRequest_privilegeSetV2Id_fkey"
  FOREIGN KEY ("privilegeSetV2Id") REFERENCES "PrivilegeSetV2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PrivilegeRequest_privilegeSetV2Id_idx" ON "PrivilegeRequest"("privilegeSetV2Id");

