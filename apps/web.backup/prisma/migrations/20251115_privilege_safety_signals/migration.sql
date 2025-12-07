-- CreateEnum
CREATE TYPE "PrivilegeSafetySignalType" AS ENUM (
    'LICENSE_RISK',
    'QUALITY_RISK',
    'EHR_MISMATCH',
    'COMPACT_ELIGIBILITY_LOSS',
    'PAYER_DENIAL_SPIKE',
    'OPPE_LOW',
    'FPPE_FAILURE',
    'DEA_EXPIRED',
    'BOARD_EXPIRED',
    'NPDB_FLAG'
);

-- CreateEnum
CREATE TYPE "PrivilegeSafetySeverity" AS ENUM ('LOW', 'MED', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "PrivilegeSafetySignal" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "signalType" "PrivilegeSafetySignalType" NOT NULL,
    "severity" "PrivilegeSafetySeverity" NOT NULL,
    "privilegeCodes" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "details" JSONB,
    "recommendedAction" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegeSafetySignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivilegeSafetySignal_clinicianId_detectedAt_idx" ON "PrivilegeSafetySignal"("clinicianId", "detectedAt");

-- CreateIndex
CREATE INDEX "PrivilegeSafetySignal_signalType_idx" ON "PrivilegeSafetySignal"("signalType");

-- CreateIndex
CREATE INDEX "PrivilegeSafetySignal_severity_idx" ON "PrivilegeSafetySignal"("severity");

-- CreateIndex
CREATE INDEX "PrivilegeSafetySignal_resolvedAt_idx" ON "PrivilegeSafetySignal"("resolvedAt");

-- CreateIndex
CREATE INDEX "PrivilegeSafetySignal_acknowledgedAt_idx" ON "PrivilegeSafetySignal"("acknowledgedAt");

-- AddForeignKey
ALTER TABLE "PrivilegeSafetySignal"
ADD CONSTRAINT "PrivilegeSafetySignal_clinicianId_fkey"
FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

