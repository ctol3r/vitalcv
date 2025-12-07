/**
 * B247C-GAM-021: Leaderboard Model
 *
 * Model for leaderboard entries: id, userId, pointsTotal, period (daily/weekly/monthly/all-time),
 * rank (int), createdAt; ensures unique per user and period.
 */

import { PrismaClient, Leaderboard as PrismaLeaderboard, LeaderboardPeriod } from '@prisma/client';

export interface LeaderboardInput {
  userId: string;
  pointsTotal: number;
  period: LeaderboardPeriod;
  rank: number;
}

export interface Leaderboard {
  id: string;
  userId: string;
  pointsTotal: number;
  period: LeaderboardPeriod;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create or update a leaderboard entry
 * Ensures unique per user and period
 */
export async function upsertLeaderboardEntry(
  prisma: PrismaClient,
  input: LeaderboardInput
): Promise<Leaderboard> {
  return prisma.leaderboard.upsert({
    where: {
      userId_period: {
        userId: input.userId,
        period: input.period,
      },
    },
    create: {
      userId: input.userId,
      pointsTotal: input.pointsTotal,
      period: input.period,
      rank: input.rank,
    },
    update: {
      pointsTotal: input.pointsTotal,
      rank: input.rank,
    },
  });
}

/**
 * Get leaderboard entry for a user and period
 */
export async function getLeaderboardEntry(
  prisma: PrismaClient,
  userId: string,
  period: LeaderboardPeriod
): Promise<Leaderboard | null> {
  return prisma.leaderboard.findUnique({
    where: {
      userId_period: {
        userId,
        period,
      },
    },
  });
}

/**
 * Get top N leaderboard entries for a period
 */
export async function getTopLeaderboardEntries(
  prisma: PrismaClient,
  period: LeaderboardPeriod,
  limit: number = 100
): Promise<Leaderboard[]> {
  return prisma.leaderboard.findMany({
    where: {
      period,
    },
    orderBy: [
      { rank: 'asc' },
      { pointsTotal: 'desc' },
    ],
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  } as any);
}

/**
 * Get user's rank in leaderboard for a period
 */
export async function getUserRank(
  prisma: PrismaClient,
  userId: string,
  period: LeaderboardPeriod
): Promise<number | null> {
  const entry = await getLeaderboardEntry(prisma, userId, period);
  return entry?.rank ?? null;
}

/**
 * Get leaderboard entries around a user's rank (for context)
 */
export async function getLeaderboardAroundUser(
  prisma: PrismaClient,
  userId: string,
  period: LeaderboardPeriod,
  contextSize: number = 5
): Promise<{
  entries: Leaderboard[];
  userEntry: Leaderboard | null;
  userRank: number | null;
}> {
  const userEntry = await getLeaderboardEntry(prisma, userId, period);
  if (!userEntry) {
    return {
      entries: [],
      userEntry: null,
      userRank: null,
    };
  }

  const userRank = userEntry.rank;
  const startRank = Math.max(1, userRank - contextSize);
  const endRank = userRank + contextSize;

  // Get entries around the user's rank
  const entries = await prisma.leaderboard.findMany({
    where: {
      period,
      rank: {
        gte: startRank,
        lte: endRank,
      },
    },
    orderBy: [
      { rank: 'asc' },
      { pointsTotal: 'desc' },
    ],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  } as any);

  return {
    entries,
    userEntry,
    userRank,
  };
}

/**
 * Delete leaderboard entry
 */
export async function deleteLeaderboardEntry(
  prisma: PrismaClient,
  userId: string,
  period: LeaderboardPeriod
): Promise<void> {
  await prisma.leaderboard.delete({
    where: {
      userId_period: {
        userId,
        period,
      },
    },
  });
}

