-- Wave 10: VerificationArtifact model (primary-source evidence)
CREATE TABLE "VerificationArtifact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "npi" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawPayload" JSONB,
    "checksum" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "monitoring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationArtifact_npi_idx" ON "VerificationArtifact"("npi");
CREATE INDEX "VerificationArtifact_source_idx" ON "VerificationArtifact"("source");
CREATE INDEX "VerificationArtifact_monitoring_idx" ON "VerificationArtifact"("monitoring");
CREATE INDEX "VerificationArtifact_createdAt_idx" ON "VerificationArtifact"("createdAt");

-- Wave 11: AuditSnapshot model (bundle state freeze)
CREATE TABLE "AuditSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditSnapshot_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "VerificationArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AuditSnapshot_artifactId_idx" ON "AuditSnapshot"("artifactId");
CREATE INDEX "AuditSnapshot_createdAt_idx" ON "AuditSnapshot"("createdAt");
