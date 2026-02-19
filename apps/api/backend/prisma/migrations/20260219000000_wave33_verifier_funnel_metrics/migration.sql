-- Wave 33: Verifier lifecycle field

CREATE TYPE "VerifierLifecycle" AS ENUM (
  'REGISTERED',
  'TOKEN_SENT',
  'TOKEN_USED',
  'PILOT_ACTIVATED',
  'BUNDLE_GENERATED'
);

ALTER TABLE "VerifierOrg"
  ADD COLUMN "lifecycle" "VerifierLifecycle" NOT NULL DEFAULT 'REGISTERED';

CREATE INDEX "VerifierOrg_lifecycle_idx" ON "VerifierOrg"("lifecycle");
