-- Task 116.1 — PrivilegeSet model for hospital-specific procedure stacks

CREATE TABLE IF NOT EXISTS "PrivilegeSet" (
  "id" TEXT PRIMARY KEY,
  "hospitalId" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "procedures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrivilegeSet_hospital_specialty_version_idx"
  ON "PrivilegeSet" ("hospitalId", "specialty", "version");

CREATE INDEX IF NOT EXISTS "PrivilegeSet_hospitalId_idx"
  ON "PrivilegeSet" ("hospitalId");










