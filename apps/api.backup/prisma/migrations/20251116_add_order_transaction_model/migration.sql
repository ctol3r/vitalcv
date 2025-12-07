-- B223B-MARKET-007: Add OrderTransaction model for recording purchases

-- Create OrderTransaction table
CREATE TABLE IF NOT EXISTS "OrderTransaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receiptUrl" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTransaction_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on transactionId
CREATE UNIQUE INDEX IF NOT EXISTS "OrderTransaction_transactionId_key" ON "OrderTransaction"("transactionId");

-- Create indexes for OrderTransaction
CREATE INDEX IF NOT EXISTS "OrderTransaction_transactionId_idx" ON "OrderTransaction"("transactionId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_moduleId_idx" ON "OrderTransaction"("moduleId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_vendorId_idx" ON "OrderTransaction"("vendorId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_purchaserId_idx" ON "OrderTransaction"("purchaserId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_status_idx" ON "OrderTransaction"("status");
CREATE INDEX IF NOT EXISTS "OrderTransaction_currency_idx" ON "OrderTransaction"("currency");
CREATE INDEX IF NOT EXISTS "OrderTransaction_timestamp_idx" ON "OrderTransaction"("timestamp");
CREATE INDEX IF NOT EXISTS "OrderTransaction_vendorId_timestamp_idx" ON "OrderTransaction"("vendorId", "timestamp");
CREATE INDEX IF NOT EXISTS "OrderTransaction_purchaserId_timestamp_idx" ON "OrderTransaction"("purchaserId", "timestamp");

