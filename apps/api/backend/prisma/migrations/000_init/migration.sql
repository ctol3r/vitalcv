-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "Recognition" (
    "id" UUID NOT NULL,
    "recognitionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "recognizedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationRef" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationRef" TEXT,
    "eventHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acceptance" (
    "id" UUID NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "recognitionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "psvReportId" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Start" (
    "id" UUID NOT NULL,
    "startId" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL,
    "eventHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Start_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsvReceipt" (
    "id" UUID NOT NULL,
    "receiptId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "responseHash" TEXT NOT NULL,
    "ttlSeconds" INTEGER NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "lane" TEXT,
    "verificationCheck" TEXT,
    "verificationOutcome" TEXT,
    "failureReason" TEXT,
    "source" TEXT,
    "attestorId" TEXT,
    "verificationRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsvReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianIdentity" (
    "id" UUID NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateCredential" (
    "id" UUID NOT NULL,
    "candidateCredentialId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestConflict" (
    "id" UUID NOT NULL,
    "conflictId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotentResponse" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "auditRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "keyHash" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['write:recognitions', 'write:acceptances', 'write:starts', 'write:ingest']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParRequest" (
    "id" UUID NOT NULL,
    "requestUri" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestJson" JSONB NOT NULL,
    "clientId" TEXT NOT NULL,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "redirectUri" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JtiReplay" (
    "service" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JtiReplay_pkey" PRIMARY KEY ("service","jti")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "tokenId" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "scope" TEXT NOT NULL,
    "cnfJkt" TEXT,
    "clientCert" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotated" BOOLEAN NOT NULL DEFAULT false,
    "rotatedTo" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "VerifierNonce" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifierNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "requestId" UUID NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "attestorId" TEXT,
    "documentHash" TEXT,
    "subject" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "receiptId" TEXT,
    "failureReason" TEXT,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "referenceId" TEXT,
    "clinicianId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recognition_recognitionId_key" ON "Recognition"("recognitionId");
CREATE INDEX "Recognition_subjectId_idx" ON "Recognition"("subjectId");
CREATE INDEX "Recognition_employerId_idx" ON "Recognition"("employerId");
CREATE INDEX "Recognition_recognitionId_idx" ON "Recognition"("recognitionId");

CREATE UNIQUE INDEX "Acceptance_acceptanceId_key" ON "Acceptance"("acceptanceId");
CREATE INDEX "Acceptance_subjectId_idx" ON "Acceptance"("subjectId");
CREATE INDEX "Acceptance_employerId_idx" ON "Acceptance"("employerId");
CREATE INDEX "Acceptance_recognitionId_idx" ON "Acceptance"("recognitionId");
CREATE INDEX "Acceptance_acceptanceId_idx" ON "Acceptance"("acceptanceId");

CREATE UNIQUE INDEX "Start_startId_key" ON "Start"("startId");
CREATE INDEX "Start_subjectId_idx" ON "Start"("subjectId");
CREATE INDEX "Start_employerId_idx" ON "Start"("employerId");
CREATE INDEX "Start_acceptanceId_idx" ON "Start"("acceptanceId");
CREATE INDEX "Start_startId_idx" ON "Start"("startId");

CREATE UNIQUE INDEX "PsvReceipt_receiptId_key" ON "PsvReceipt"("receiptId");
CREATE INDEX "PsvReceipt_clinicianId_idx" ON "PsvReceipt"("clinicianId");
CREATE INDEX "PsvReceipt_receiptId_idx" ON "PsvReceipt"("receiptId");

CREATE UNIQUE INDEX "ClinicianIdentity_clinicianId_key" ON "ClinicianIdentity"("clinicianId");
CREATE UNIQUE INDEX "CandidateCredential_candidateCredentialId_key" ON "CandidateCredential"("candidateCredentialId");
CREATE INDEX "CandidateCredential_clinicianId_idx" ON "CandidateCredential"("clinicianId");

CREATE UNIQUE INDEX "IngestConflict_conflictId_key" ON "IngestConflict"("conflictId");
CREATE INDEX "IngestConflict_clinicianId_idx" ON "IngestConflict"("clinicianId");

CREATE UNIQUE INDEX "IdempotentResponse_key_key" ON "IdempotentResponse"("key");
CREATE INDEX "IdempotentResponse_key_idx" ON "IdempotentResponse"("key");
CREATE INDEX "IdempotentResponse_expiresAt_idx" ON "IdempotentResponse"("expiresAt");

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

CREATE UNIQUE INDEX "ParRequest_requestUri_key" ON "ParRequest"("requestUri");
CREATE INDEX "ParRequest_requestType_idx" ON "ParRequest"("requestType");
CREATE INDEX "ParRequest_expiresAt_idx" ON "ParRequest"("expiresAt");
CREATE INDEX "ParRequest_createdAt_idx" ON "ParRequest"("createdAt");

CREATE INDEX "JtiReplay_expiresAt_idx" ON "JtiReplay"("expiresAt");
CREATE INDEX "VerifierNonce_used_idx" ON "VerifierNonce"("used");
CREATE INDEX "VerifierNonce_expiresAt_idx" ON "VerifierNonce"("expiresAt");

CREATE INDEX "VerificationRequest_clinicianId_idx" ON "VerificationRequest"("clinicianId");
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");
CREATE INDEX "VerificationRequest_createdAt_idx" ON "VerificationRequest"("createdAt");

CREATE INDEX "AuditEvent_type_createdAt_idx" ON "AuditEvent"("type", "createdAt");
CREATE INDEX "AuditEvent_clinicianId_idx" ON "AuditEvent"("clinicianId");
CREATE INDEX "AuditEvent_referenceId_idx" ON "AuditEvent"("referenceId");

-- Foreign keys
ALTER TABLE "Acceptance" ADD CONSTRAINT "Acceptance_recognitionId_fkey" FOREIGN KEY ("recognitionId") REFERENCES "Recognition"("recognitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Start" ADD CONSTRAINT "Start_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "Acceptance"("acceptanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
