-- FHIR subscription table for outbound notifications
CREATE TYPE "FHIRSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FAILED');

CREATE TABLE "FHIRSubscription" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "resourceType" TEXT NOT NULL,
  "criteria" TEXT NOT NULL,
  "callbackUrl" TEXT NOT NULL,
  "status" "FHIRSubscriptionStatus" NOT NULL DEFAULT 'PAUSED',
  "lastHandshakeAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FHIRSubscription_resourceType_idx" ON "FHIRSubscription" ("resourceType");
CREATE INDEX "FHIRSubscription_status_idx" ON "FHIRSubscription" ("status");

CREATE OR REPLACE FUNCTION update_fhir_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fhir_subscription_updated_at
BEFORE UPDATE ON "FHIRSubscription"
FOR EACH ROW
EXECUTE FUNCTION update_fhir_subscription_updated_at();

