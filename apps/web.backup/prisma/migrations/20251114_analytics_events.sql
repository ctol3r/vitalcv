-- B163C-AN: Analytics event log + daily rollups

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT,
  "orgId" TEXT,
  "metadata" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_orgId_idx" ON "AnalyticsEvent"("orgId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_subjectId_idx" ON "AnalyticsEvent"("subjectId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_orgId_timestamp_idx" ON "AnalyticsEvent"("orgId","timestamp");

CREATE TABLE IF NOT EXISTS "AnalyticsDailyRollup" (
  "id" TEXT PRIMARY KEY,
  "date" TIMESTAMP(3) NOT NULL,
  "orgId" TEXT,
  "applications" INTEGER NOT NULL DEFAULT 0,
  "privilegesGranted" INTEGER NOT NULL DEFAULT 0,
  "verifications" INTEGER NOT NULL DEFAULT 0,
  "payerEnrollments" INTEGER NOT NULL DEFAULT 0,
  "ehrFetches" INTEGER NOT NULL DEFAULT 0,
  "vcsIssued" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsDailyRollup_date_orgId_key" UNIQUE ("date","orgId")
);

CREATE INDEX IF NOT EXISTS "AnalyticsDailyRollup_date_idx" ON "AnalyticsDailyRollup"("date");
CREATE INDEX IF NOT EXISTS "AnalyticsDailyRollup_orgId_idx" ON "AnalyticsDailyRollup"("orgId");

-- B163C-AN-001: Analytics events + rollups
-- Stores immutable event stream and aggregated daily counts per org/global scope

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT,
  "orgId" TEXT,
  "metadata" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent" ("eventType");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_orgId_idx" ON "AnalyticsEvent" ("orgId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent" ("timestamp");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_subjectId_idx" ON "AnalyticsEvent" ("subjectId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_orgId_timestamp_idx" ON "AnalyticsEvent" ("orgId", "timestamp");

CREATE TABLE IF NOT EXISTS "AnalyticsDailyRollup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TIMESTAMP(3) NOT NULL,
  "orgId" TEXT,
  "applications" INTEGER NOT NULL DEFAULT 0,
  "privilegesGranted" INTEGER NOT NULL DEFAULT 0,
  "verifications" INTEGER NOT NULL DEFAULT 0,
  "payerEnrollments" INTEGER NOT NULL DEFAULT 0,
  "ehrFetches" INTEGER NOT NULL DEFAULT 0,
  "vcsIssued" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnalyticsDailyRollup_date_idx" ON "AnalyticsDailyRollup" ("date");
CREATE INDEX IF NOT EXISTS "AnalyticsDailyRollup_orgId_idx" ON "AnalyticsDailyRollup" ("orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsDailyRollup_date_orgId_key" ON "AnalyticsDailyRollup" ("date", "orgId");

