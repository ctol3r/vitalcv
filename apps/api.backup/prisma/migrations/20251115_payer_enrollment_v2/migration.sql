-- B185C-PAYER-001: Introduce PayerEnrollmentV2 model
CREATE TYPE "PayerEnrollmentV2Status" AS ENUM (
  'PENDING',
  'ATTEMPTING',
  'ENROLLED',
  'PANEL_FULL',
  'REJECTED',
  'REVALIDATION_DUE'
);

CREATE TABLE "PayerEnrollmentV2" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "payerId" TEXT NOT NULL,
  "status" "PayerEnrollmentV2Status" NOT NULL DEFAULT 'PENDING',
  "effectiveDate" TIMESTAMP(3),
  "panelType" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "metadata" JSONB,
  "lastStatusChange" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayerEnrollmentV2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayerEnrollmentV2_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayerEnrollmentV2_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PayerEnrollmentV2_clinicianId_idx" ON "PayerEnrollmentV2"("clinicianId");
CREATE INDEX "PayerEnrollmentV2_payerId_idx" ON "PayerEnrollmentV2"("payerId");
CREATE INDEX "PayerEnrollmentV2_status_idx" ON "PayerEnrollmentV2"("status");
