-- Wave U-V-W: Nursys ingestion, PECOS alignment, and cross-check bundle schema updates

CREATE TABLE "NursysEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "npi" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NursysEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NursysEvent_npi_idx" ON "NursysEvent"("npi");
CREATE INDEX "NursysEvent_licenseNumber_idx" ON "NursysEvent"("licenseNumber");

CREATE TABLE "PecosCheck" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "npi" TEXT NOT NULL,
    "enrolled" BOOLEAN NOT NULL,
    "enrollmentType" TEXT,
    "rawPayload" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PecosCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PecosCheck_npi_idx" ON "PecosCheck"("npi");

CREATE TABLE "CrossCheckBundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "crossCheckPass" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossCheckBundle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrossCheckBundle_artifactId_idx" ON "CrossCheckBundle"("artifactId");
