-- B232B-SEARCH-006: Add SearchAnalyticsTracker models
-- B232B-SEARCH-009: Add SearchTrendReporter models

-- Create SearchQuery table for tracking search queries
CREATE TABLE IF NOT EXISTS "SearchQuery" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "entityType" TEXT, -- 'provider' | 'credential' | 'module' | 'contract' | 'job'
    "filters" JSONB,
    "userId" TEXT, -- Anonymized user ID
    "orgId" TEXT, -- Anonymized organization ID
    "region" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- Create SearchClickThrough table for tracking click-through events
CREATE TABLE IF NOT EXISTS "SearchClickThrough" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "resultType" TEXT NOT NULL, -- 'provider' | 'credential' | 'module' | 'contract' | 'job'
    "position" INTEGER NOT NULL, -- Position in results (1-indexed)
    "userId" TEXT, -- Anonymized user ID
    "orgId" TEXT, -- Anonymized organization ID
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchClickThrough_pkey" PRIMARY KEY ("id")
);

-- Create SearchConversion table for tracking conversion events
CREATE TABLE IF NOT EXISTS "SearchConversion" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "resultType" TEXT NOT NULL, -- 'provider' | 'credential' | 'module' | 'contract' | 'job'
    "conversionType" TEXT NOT NULL, -- 'purchase' | 'download' | 'contact' | 'apply' | 'view_details'
    "userId" TEXT, -- Anonymized user ID
    "orgId" TEXT, -- Anonymized organization ID
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchConversion_pkey" PRIMARY KEY ("id")
);

-- Create indexes for SearchQuery
CREATE INDEX IF NOT EXISTS "SearchQuery_query_idx" ON "SearchQuery"("query");
CREATE INDEX IF NOT EXISTS "SearchQuery_entityType_idx" ON "SearchQuery"("entityType");
CREATE INDEX IF NOT EXISTS "SearchQuery_region_idx" ON "SearchQuery"("region");
CREATE INDEX IF NOT EXISTS "SearchQuery_timestamp_idx" ON "SearchQuery"("timestamp");
CREATE INDEX IF NOT EXISTS "SearchQuery_userId_idx" ON "SearchQuery"("userId");
CREATE INDEX IF NOT EXISTS "SearchQuery_orgId_idx" ON "SearchQuery"("orgId");
CREATE INDEX IF NOT EXISTS "SearchQuery_timestamp_entityType_idx" ON "SearchQuery"("timestamp", "entityType");

-- Create indexes for SearchClickThrough
CREATE INDEX IF NOT EXISTS "SearchClickThrough_queryId_idx" ON "SearchClickThrough"("queryId");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_resultId_idx" ON "SearchClickThrough"("resultId");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_resultType_idx" ON "SearchClickThrough"("resultType");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_position_idx" ON "SearchClickThrough"("position");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_timestamp_idx" ON "SearchClickThrough"("timestamp");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_userId_idx" ON "SearchClickThrough"("userId");
CREATE INDEX IF NOT EXISTS "SearchClickThrough_orgId_idx" ON "SearchClickThrough"("orgId");

-- Create indexes for SearchConversion
CREATE INDEX IF NOT EXISTS "SearchConversion_queryId_idx" ON "SearchConversion"("queryId");
CREATE INDEX IF NOT EXISTS "SearchConversion_resultId_idx" ON "SearchConversion"("resultId");
CREATE INDEX IF NOT EXISTS "SearchConversion_resultType_idx" ON "SearchConversion"("resultType");
CREATE INDEX IF NOT EXISTS "SearchConversion_conversionType_idx" ON "SearchConversion"("conversionType");
CREATE INDEX IF NOT EXISTS "SearchConversion_timestamp_idx" ON "SearchConversion"("timestamp");
CREATE INDEX IF NOT EXISTS "SearchConversion_userId_idx" ON "SearchConversion"("userId");
CREATE INDEX IF NOT EXISTS "SearchConversion_orgId_idx" ON "SearchConversion"("orgId");

-- Add foreign key constraints (optional, for referential integrity)
-- Note: These assume SearchQuery.id exists. Adjust based on your needs.
-- ALTER TABLE "SearchClickThrough" ADD CONSTRAINT "SearchClickThrough_queryId_fkey"
--     FOREIGN KEY ("queryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE;
-- ALTER TABLE "SearchConversion" ADD CONSTRAINT "SearchConversion_queryId_fkey"
--     FOREIGN KEY ("queryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE;

