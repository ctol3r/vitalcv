-- CreateTable
CREATE TABLE "ATSWebhook" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ATSWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ATSWebhook_orgId_idx" ON "ATSWebhook"("orgId");











