-- B247C-GAM-021: Add Leaderboard model for gamification
-- B247C-GAM-028: Add UserGamificationPreferences model

-- Create LeaderboardPeriod enum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- Create Leaderboard table
CREATE TABLE IF NOT EXISTS "Leaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "period" "LeaderboardPeriod" NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- Create UserGamificationPreferences table
CREATE TABLE IF NOT EXISTS "UserGamificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT true,
    "notificationsOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGamificationPreferences_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "Leaderboard_userId_period_key" ON "Leaderboard"("userId", "period");
CREATE UNIQUE INDEX "UserGamificationPreferences_userId_key" ON "UserGamificationPreferences"("userId");

-- Create indexes
CREATE INDEX "Leaderboard_userId_idx" ON "Leaderboard"("userId");
CREATE INDEX "Leaderboard_period_rank_idx" ON "Leaderboard"("period", "rank");
CREATE INDEX "Leaderboard_period_pointsTotal_idx" ON "Leaderboard"("period", "pointsTotal");
CREATE INDEX "Leaderboard_createdAt_idx" ON "Leaderboard"("createdAt");
CREATE INDEX "UserGamificationPreferences_userId_idx" ON "UserGamificationPreferences"("userId");

-- Add foreign key constraints
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGamificationPreferences" ADD CONSTRAINT "UserGamificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

