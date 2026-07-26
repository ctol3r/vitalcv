-- Identity-binding possession factor: one-time email verification.
-- The email OTP code is never stored (only a salted hash); challenges are
-- short-lived, attempt-capped, and single-use. A verified challenge records a
-- possession signal on person_profiles (verified_email / verified_email_at) —
-- a corroboration that strengthens NPI->person binding, NOT a license or
-- identity verification on its own.

CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'identity_email',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_otps_user_id_idx" ON "email_otps"("user_id");
CREATE INDEX "email_otps_email_idx" ON "email_otps"("email");

ALTER TABLE "person_profiles"
  ADD COLUMN IF NOT EXISTS "verified_email" TEXT,
  ADD COLUMN IF NOT EXISTS "verified_email_at" TIMESTAMP(3);
