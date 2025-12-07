-- B247B-GAM-020: Badge Migration
-- Creates Badge and AchievementProgress tables for the gamification system

-- Create Badge table
CREATE TABLE IF NOT EXISTS "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "iconId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- Create AchievementProgress table
CREATE TABLE IF NOT EXISTS "AchievementProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "currentProgress" JSONB NOT NULL DEFAULT '{}',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementProgress_pkey" PRIMARY KEY ("id")
);

-- Create BadgeAssignment table to track awarded badges
CREATE TABLE IF NOT EXISTS "BadgeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAssignment_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Badge
CREATE UNIQUE INDEX IF NOT EXISTS "Badge_slug_key" ON "Badge"("slug");
CREATE INDEX IF NOT EXISTS "Badge_isActive_idx" ON "Badge"("isActive");
CREATE INDEX IF NOT EXISTS "Badge_level_idx" ON "Badge"("level");

-- Create indexes for AchievementProgress
CREATE INDEX IF NOT EXISTS "AchievementProgress_userId_idx" ON "AchievementProgress"("userId");
CREATE INDEX IF NOT EXISTS "AchievementProgress_badgeId_idx" ON "AchievementProgress"("badgeId");
CREATE INDEX IF NOT EXISTS "AchievementProgress_completed_idx" ON "AchievementProgress"("completed");
CREATE UNIQUE INDEX IF NOT EXISTS "AchievementProgress_userId_badgeId_key" ON "AchievementProgress"("userId", "badgeId");

-- Create indexes for BadgeAssignment
CREATE INDEX IF NOT EXISTS "BadgeAssignment_userId_idx" ON "BadgeAssignment"("userId");
CREATE INDEX IF NOT EXISTS "BadgeAssignment_badgeId_idx" ON "BadgeAssignment"("badgeId");
CREATE UNIQUE INDEX IF NOT EXISTS "BadgeAssignment_userId_badgeId_key" ON "BadgeAssignment"("userId", "badgeId");

-- Add foreign key constraints (assuming User table exists)
-- Note: These will fail if User table doesn't exist, but that's expected
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        ALTER TABLE "AchievementProgress" ADD CONSTRAINT "AchievementProgress_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "BadgeAssignment" ADD CONSTRAINT "BadgeAssignment_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key for badgeId
ALTER TABLE "AchievementProgress" ADD CONSTRAINT "AchievementProgress_badgeId_fkey"
    FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BadgeAssignment" ADD CONSTRAINT "BadgeAssignment_badgeId_fkey"
    FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

