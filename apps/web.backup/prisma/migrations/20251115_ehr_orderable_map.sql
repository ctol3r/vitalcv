-- B189A-EHR-001: EHROrderableMap table for privilege-to-orderable mappings

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EhrSystem') THEN
    CREATE TYPE "EhrSystem" AS ENUM ('EPIC', 'CERNER', 'MEDITECH');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "EHROrderableMap" (
  "id" TEXT PRIMARY KEY,
  "privilegeMatrixId" TEXT,
  "privilegeCode" TEXT NOT NULL,
  "ehrSystem" "EhrSystem" NOT NULL,
  "ehrCode" TEXT NOT NULL,
  "description" TEXT,
  "requiredRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EHROrderableMap_privilegeCode_ehrSystem_key"
  ON "EHROrderableMap"("privilegeCode","ehrSystem");

CREATE INDEX IF NOT EXISTS "EHROrderableMap_ehrCode_ehrSystem_idx"
  ON "EHROrderableMap"("ehrCode","ehrSystem");

CREATE INDEX IF NOT EXISTS "EHROrderableMap_privilegeMatrixId_idx"
  ON "EHROrderableMap"("privilegeMatrixId");

ALTER TABLE "EHROrderableMap"
  ADD CONSTRAINT IF NOT EXISTS "EHROrderableMap_privilegeMatrixId_fkey"
  FOREIGN KEY ("privilegeMatrixId") REFERENCES "PrivilegeMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

