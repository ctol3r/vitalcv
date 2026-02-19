-- Wave 36: Add trusted issuer registry and credential transparency log
CREATE TABLE "TrustedIssuer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "publicKeyJwk" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedIssuer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustedIssuer_did_key" UNIQUE ("did")
);

CREATE TABLE "CredentialTransparencyLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialTransparencyLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CredentialTransparencyLog_artifactId_idx" ON "CredentialTransparencyLog"("artifactId");
CREATE INDEX "CredentialTransparencyLog_fingerprint_idx" ON "CredentialTransparencyLog"("fingerprint");
