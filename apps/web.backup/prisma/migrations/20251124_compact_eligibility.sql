-- CreateTable
CREATE TABLE "CompactEligibility" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "compact" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "rationale" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompactEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompactEligibility_clinicianId_idx" ON "CompactEligibility"("clinicianId");

-- CreateIndex
CREATE INDEX "CompactEligibility_compact_idx" ON "CompactEligibility"("clinicianId","compact");

-- CreateIndex
CREATE UNIQUE INDEX "CompactEligibility_clinician_compact_key" ON "CompactEligibility"("clinicianId","compact");


