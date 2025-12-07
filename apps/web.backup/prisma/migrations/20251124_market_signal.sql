-- CreateTable
CREATE TABLE "MarketSignal" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "demand" DOUBLE PRECISION NOT NULL,
    "supply" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSignal_region_specialty_idx" ON "MarketSignal"("region", "specialty");

-- CreateIndex
CREATE INDEX "MarketSignal_updatedAt_idx" ON "MarketSignal"("updatedAt");



