-- Wave 198: NPI-bound DID identity binding

CREATE TYPE "NpiDidBindingStatus" AS ENUM ('ACTIVE', 'CONTESTED', 'REVOKED', 'PENDING');

CREATE TABLE "npi_did_binding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "npi" TEXT NOT NULL,
  "did" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "recipeVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "evidencePointers" JSONB NOT NULL,
  "status" "NpiDidBindingStatus" NOT NULL DEFAULT 'ACTIVE',
  "contestReason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "npi_did_binding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "npi_did_binding_npi_key" UNIQUE ("npi"),
  CONSTRAINT "npi_did_binding_did_key" UNIQUE ("did")
);

CREATE INDEX "npi_did_binding_npi_idx" ON "npi_did_binding"("npi");
CREATE INDEX "npi_did_binding_did_idx" ON "npi_did_binding"("did");
