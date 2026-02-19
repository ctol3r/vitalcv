-- Wave 2A: Normalized persistence layer
-- Provider → VerificationRun → W2Artifact, DeltaLog

-- CreateTable
CREATE TABLE "Provider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "npi" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "taxonomyCode" TEXT NOT NULL,
    "stateOfPractice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL,
    "sourceName" TEXT NOT NULL,
    "retrievedAtUtc" TIMESTAMP(3) NOT NULL,
    "rawPayloadHash" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "W2Artifact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verificationRunId" UUID NOT NULL,
    "artifactJson" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL,
    "signatureIssuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "W2Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeltaLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" UUID NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "deltaHash" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeltaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_npi_key" ON "Provider"("npi");

-- AddForeignKey
ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "W2Artifact" ADD CONSTRAINT "W2Artifact_verificationRunId_fkey" FOREIGN KEY ("verificationRunId") REFERENCES "VerificationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeltaLog" ADD CONSTRAINT "DeltaLog_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "W2Artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
