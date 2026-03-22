-- CreateTable: passkey_credentials
CREATE TABLE "passkey_credentials" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "device_type" TEXT NOT NULL DEFAULT 'platform',
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "rp_id" TEXT NOT NULL,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: npi_ownership
CREATE TABLE "npi_ownership" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "verification_method" TEXT NOT NULL DEFAULT 'CLAIMED',
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "npi_ownership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique credential_id
CREATE UNIQUE INDEX "passkey_credentials_credential_id_key" ON "passkey_credentials"("credential_id");

-- CreateIndex: unique userId + npi
CREATE UNIQUE INDEX "npi_ownership_user_id_npi_key" ON "npi_ownership"("user_id", "npi");

-- CreateIndex: npi lookup
CREATE INDEX "npi_ownership_npi_idx" ON "npi_ownership"("npi");

-- AddForeignKey: passkey_credentials → users
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: npi_ownership → users
ALTER TABLE "npi_ownership" ADD CONSTRAINT "npi_ownership_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
