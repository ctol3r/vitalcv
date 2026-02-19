-- CreateTable
CREATE TABLE "ShareLink" (
    "id" UUID NOT NULL,
    "npi" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifierAcceptance" (
    "id" UUID NOT NULL,
    "organization" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifierAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShareLink_npi_idx" ON "ShareLink"("npi");
CREATE INDEX "ShareLink_createdAt_idx" ON "ShareLink"("createdAt");
CREATE INDEX "VerifierAcceptance_organization_idx" ON "VerifierAcceptance"("organization");
CREATE INDEX "VerifierAcceptance_acceptedAt_idx" ON "VerifierAcceptance"("acceptedAt");
