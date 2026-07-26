-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "sealed_packet_version" INTEGER;

-- CreateTable
CREATE TABLE "application_packets" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "packet_version" INTEGER NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "clinician_npi" TEXT NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "employer_org_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "selected_sections" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "clinician_note" TEXT,
    "methodology_version" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "consent_receipt_id" TEXT NOT NULL,
    "packet_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_by_packet_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "application_packets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_packets_packet_hash_key" ON "application_packets"("packet_hash");

-- CreateIndex
CREATE INDEX "application_packets_clerk_user_id_idx" ON "application_packets"("clerk_user_id");

-- CreateIndex
CREATE INDEX "application_packets_opportunity_id_idx" ON "application_packets"("opportunity_id");

-- CreateIndex
CREATE INDEX "application_packets_employer_org_id_idx" ON "application_packets"("employer_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_packets_application_id_packet_version_key" ON "application_packets"("application_id", "packet_version");

-- AddForeignKey
ALTER TABLE "application_packets" ADD CONSTRAINT "application_packets_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

