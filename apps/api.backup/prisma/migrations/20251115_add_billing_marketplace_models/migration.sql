-- S72-STRETCH-E-001: Add OrgRevenueShare table
-- S72-STRETCH-E-004: Add MarketplaceListing table
-- S72-STRETCH-E-006: Add MarketplacePurchase table
-- S72-STRETCH-E-008: Add VitaLedger table
-- B119C-ROI-024: Add RevenueRecognition table

-- Create OrgRevenueShare table
CREATE TABLE IF NOT EXISTS "OrgRevenueShare" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "basisPoints" INTEGER NOT NULL,
    "minGuarantee" INTEGER,
    "maxCap" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgRevenueShare_pkey" PRIMARY KEY ("id")
);

-- Create MarketplaceListing table
CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "fiatPrice" INTEGER,
    "vitaPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- Create MarketplacePurchase table
CREATE TABLE IF NOT EXISTS "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "vitaTxId" TEXT,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- Create VitaLedger table
CREATE TABLE IF NOT EXISTS "VitaLedger" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "txId" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitaLedger_pkey" PRIMARY KEY ("id")
);

-- Create RevenueRecognition table
CREATE TABLE IF NOT EXISTS "RevenueRecognition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orgId" TEXT,
    "revenueType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "recognizedAt" TIMESTAMP(3) NOT NULL,
    "cashSettledAt" TIMESTAMP(3),
    "settlementTxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueRecognition_pkey" PRIMARY KEY ("id")
);

-- Create indexes for OrgRevenueShare
CREATE UNIQUE INDEX IF NOT EXISTS "OrgRevenueShare_orgId_key" ON "OrgRevenueShare"("orgId");
CREATE INDEX IF NOT EXISTS "OrgRevenueShare_orgId_idx" ON "OrgRevenueShare"("orgId");

-- Create indexes for MarketplaceListing
CREATE INDEX IF NOT EXISTS "MarketplaceListing_orgId_idx" ON "MarketplaceListing"("orgId");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_productType_idx" ON "MarketplaceListing"("productType");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_isActive_idx" ON "MarketplaceListing"("isActive");

-- Create indexes for MarketplacePurchase
CREATE INDEX IF NOT EXISTS "MarketplacePurchase_orgId_idx" ON "MarketplacePurchase"("orgId");
CREATE INDEX IF NOT EXISTS "MarketplacePurchase_listingId_idx" ON "MarketplacePurchase"("listingId");
CREATE INDEX IF NOT EXISTS "MarketplacePurchase_paymentType_idx" ON "MarketplacePurchase"("paymentType");
CREATE INDEX IF NOT EXISTS "MarketplacePurchase_status_idx" ON "MarketplacePurchase"("status");
CREATE INDEX IF NOT EXISTS "MarketplacePurchase_createdAt_idx" ON "MarketplacePurchase"("createdAt");

-- Create indexes for VitaLedger
CREATE INDEX IF NOT EXISTS "VitaLedger_orgId_idx" ON "VitaLedger"("orgId");
CREATE INDEX IF NOT EXISTS "VitaLedger_type_idx" ON "VitaLedger"("type");
CREATE INDEX IF NOT EXISTS "VitaLedger_txId_idx" ON "VitaLedger"("txId");
CREATE INDEX IF NOT EXISTS "VitaLedger_createdAt_idx" ON "VitaLedger"("createdAt");

-- Create indexes for RevenueRecognition
CREATE INDEX IF NOT EXISTS "RevenueRecognition_orgId_idx" ON "RevenueRecognition"("orgId");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_eventType_idx" ON "RevenueRecognition"("eventType");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_revenueType_idx" ON "RevenueRecognition"("revenueType");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_status_idx" ON "RevenueRecognition"("status");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_recognizedAt_idx" ON "RevenueRecognition"("recognizedAt");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_cashSettledAt_idx" ON "RevenueRecognition"("cashSettledAt");

-- Add foreign key constraint for MarketplacePurchase
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

