CREATE TABLE "NPIValidation" (
    "id" TEXT PRIMARY KEY DEFAULT cuid(),
    "clinicianId" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "crossRefs" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NPIValidation_clinicianId_fkey"
      FOREIGN KEY ("clinicianId")
      REFERENCES "ClinicianProfile"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NPIValidation_clinicianId_npi_key"
  ON "NPIValidation" ("clinicianId", "npi");

CREATE INDEX "NPIValidation_clinicianId_idx"
  ON "NPIValidation" ("clinicianId");

CREATE INDEX "NPIValidation_npi_idx"
  ON "NPIValidation" ("npi");









