-- B160A Risk telemetry tables
CREATE TABLE IF NOT EXISTS "ClientFingerprint" (
  "deviceId" TEXT PRIMARY KEY,
  "userId" TEXT,
  "signals" JSONB NOT NULL,
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ClientFingerprint_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientFingerprint_userId_idx"
  ON "ClientFingerprint" ("userId");

CREATE INDEX IF NOT EXISTS "ClientFingerprint_lastSeenAt_idx"
  ON "ClientFingerprint" ("lastSeenAt");

CREATE TABLE IF NOT EXISTS "RiskScore" (
  "deviceId" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0 CHECK ("score" >= 0 AND "score" <= 100),
  "reasonTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastUpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "RiskScore_pkey" PRIMARY KEY ("deviceId", "ipHash")
);

CREATE INDEX IF NOT EXISTS "RiskScore_lastUpdatedAt_idx"
  ON "RiskScore" ("lastUpdatedAt");

CREATE INDEX IF NOT EXISTS "RiskScore_score_idx"
  ON "RiskScore" ("score");

