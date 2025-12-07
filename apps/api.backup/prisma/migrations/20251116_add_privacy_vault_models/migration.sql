-- B237A-DP-001, B237A-DP-002: Create Privacy Vault Models
-- CreateTable
CREATE TYPE "DataRecordType" AS ENUM ('credential', 'contract', 'log', 'profile');

CREATE TABLE "PersonalDataVault" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "storageLocation" TEXT,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDataVault_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRecord" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "type" "DataRecordType" NOT NULL,
    "encryptedPayload" BYTEA NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VaultAuditLog" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "recordId" TEXT,
    "scope" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VaultSharingToken" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedBy" TEXT NOT NULL,
    "grantedTo" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultSharingToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VaultBackup" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "backupLocation" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "backupType" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "VaultBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalDataVault_ownerId_idx" ON "PersonalDataVault"("ownerId");
CREATE INDEX "PersonalDataVault_encryptionKeyId_idx" ON "PersonalDataVault"("encryptionKeyId");
CREATE INDEX "PersonalDataVault_storageLocation_idx" ON "PersonalDataVault"("storageLocation");
CREATE INDEX "PersonalDataVault_createdAt_idx" ON "PersonalDataVault"("createdAt");

CREATE INDEX "DataRecord_vaultId_idx" ON "DataRecord"("vaultId");
CREATE INDEX "DataRecord_type_idx" ON "DataRecord"("type");
CREATE INDEX "DataRecord_version_idx" ON "DataRecord"("version");
CREATE INDEX "DataRecord_previousVersionId_idx" ON "DataRecord"("previousVersionId");
CREATE INDEX "DataRecord_createdAt_idx" ON "DataRecord"("createdAt");
CREATE INDEX "DataRecord_deletedAt_idx" ON "DataRecord"("deletedAt");
CREATE INDEX "DataRecord_vaultId_type_idx" ON "DataRecord"("vaultId", "type");
CREATE INDEX "DataRecord_vaultId_deletedAt_idx" ON "DataRecord"("vaultId", "deletedAt");

CREATE INDEX "VaultAuditLog_vaultId_idx" ON "VaultAuditLog"("vaultId");
CREATE INDEX "VaultAuditLog_actorId_idx" ON "VaultAuditLog"("actorId");
CREATE INDEX "VaultAuditLog_action_idx" ON "VaultAuditLog"("action");
CREATE INDEX "VaultAuditLog_recordId_idx" ON "VaultAuditLog"("recordId");
CREATE INDEX "VaultAuditLog_createdAt_idx" ON "VaultAuditLog"("createdAt");
CREATE INDEX "VaultAuditLog_vaultId_action_idx" ON "VaultAuditLog"("vaultId", "action");
CREATE INDEX "VaultAuditLog_actorId_createdAt_idx" ON "VaultAuditLog"("actorId", "createdAt");

CREATE UNIQUE INDEX "VaultSharingToken_token_key" ON "VaultSharingToken"("token");
CREATE INDEX "VaultSharingToken_vaultId_idx" ON "VaultSharingToken"("vaultId");
CREATE INDEX "VaultSharingToken_grantedBy_idx" ON "VaultSharingToken"("grantedBy");
CREATE INDEX "VaultSharingToken_grantedTo_idx" ON "VaultSharingToken"("grantedTo");
CREATE INDEX "VaultSharingToken_expiresAt_idx" ON "VaultSharingToken"("expiresAt");
CREATE INDEX "VaultSharingToken_isRevoked_idx" ON "VaultSharingToken"("isRevoked");

CREATE INDEX "VaultBackup_vaultId_idx" ON "VaultBackup"("vaultId");
CREATE INDEX "VaultBackup_status_idx" ON "VaultBackup"("status");
CREATE INDEX "VaultBackup_createdAt_idx" ON "VaultBackup"("createdAt");
CREATE INDEX "VaultBackup_vaultId_status_idx" ON "VaultBackup"("vaultId", "status");

-- AddForeignKey
ALTER TABLE "PersonalDataVault" ADD CONSTRAINT "PersonalDataVault_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "PersonalDataVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "DataRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VaultAuditLog" ADD CONSTRAINT "VaultAuditLog_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "PersonalDataVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VaultSharingToken" ADD CONSTRAINT "VaultSharingToken_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "PersonalDataVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VaultBackup" ADD CONSTRAINT "VaultBackup_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "PersonalDataVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
