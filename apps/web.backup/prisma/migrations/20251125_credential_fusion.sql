-- CreateTable
CREATE TABLE "CredentialFusion" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "fusedRecord" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialFusion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CredentialFusion_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialFusion_clinicianId_key" ON "CredentialFusion"("clinicianId");

-- CreateIndex
CREATE INDEX "CredentialFusion_updatedAt_idx" ON "CredentialFusion"("updatedAt");










