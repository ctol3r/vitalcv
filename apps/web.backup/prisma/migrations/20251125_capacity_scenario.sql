-- CreateTable
CREATE TABLE "CapacityScenario" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapacityScenario_orgId_createdAt_idx" ON "CapacityScenario"("orgId", "createdAt");



