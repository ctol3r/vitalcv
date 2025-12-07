CREATE TABLE IF NOT EXISTS "BotFingerprint" (
    "id" TEXT PRIMARY KEY DEFAULT cuid(),
    "deviceSig" TEXT NOT NULL UNIQUE,
    "risk" DOUBLE PRECISION NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BotFingerprint_lastSeen_idx"
  ON "BotFingerprint" ("lastSeen");

CREATE INDEX IF NOT EXISTS "BotFingerprint_risk_idx"
  ON "BotFingerprint" ("risk");



