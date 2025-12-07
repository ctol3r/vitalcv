-- B178C-COMPACT-011: CompactConsent table
CREATE TABLE IF NOT EXISTS "CompactConsent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clinicianId" TEXT NOT NULL,
    "compactType" TEXT NOT NULL,
    "consentGivenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "CompactConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompactConsent_clinicianId_compactType_key"
    ON "CompactConsent"("clinicianId", "compactType");

CREATE INDEX IF NOT EXISTS "CompactConsent_clinicianId_idx"
    ON "CompactConsent"("clinicianId");

CREATE INDEX IF NOT EXISTS "CompactConsent_compactType_idx"
    ON "CompactConsent"("compactType");

