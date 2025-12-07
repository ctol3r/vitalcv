-- B241A-I18N-001: TranslationKey model
-- B241A-I18N-002: TranslationEntry model

-- CreateEnum
CREATE TYPE "TranslationEntryStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranslationKey" (
    "id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "defaultText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranslationEntry" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TranslationEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TranslationKey_context_key" ON "TranslationKey"("context");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationKey_context_idx" ON "TranslationKey"("context");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationKey_createdAt_idx" ON "TranslationKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TranslationEntry_keyId_locale_version_key" ON "TranslationEntry"("keyId", "locale", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationEntry_keyId_idx" ON "TranslationEntry"("keyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationEntry_locale_idx" ON "TranslationEntry"("locale");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationEntry_status_idx" ON "TranslationEntry"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationEntry_createdAt_idx" ON "TranslationEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "TranslationEntry" ADD CONSTRAINT "TranslationEntry_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "TranslationKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

