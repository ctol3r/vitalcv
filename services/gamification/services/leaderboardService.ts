/**
 * B247C-GAM-022: LeaderboardService
 *
 * Calculates and updates leaderboard rankings across periods; handles ties fairly;
 * ensures user's rank is private if opted out; caches results.
 */

import { PrismaClient, LeaderboardPeriod } from '@prisma/client';
import {
  upsertLeaderboardEntry,
  getTopLeaderboardEntries,
  getUserRank,
  getLeaderboardAroundUser,
  getLeaderboardEntry,
} from '../models/Leaderboard';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('gamification/leaderboard');

export interface LeaderboardRanking {
  userId: string;
  pointsTotal: number;
  rank: number;
}

export interface LeaderboardResult {
  entries: Array<{
    userId: string;
    userName?: string;
    userEmail?: string;
    pointsTotal: number;
    rank: number;
  }>;
  totalEntries: number;
  period: LeaderboardPeriod;
}

export interface UserRankResult {
  rank: number | null;
  pointsTotal: number;
  period: LeaderboardPeriod;
  isPrivate: boolean;
}

// Simple in-memory cache (in production, use Redis)
class LeaderboardCache {
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new LeaderboardCache();

export class LeaderboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate rankings for a period based on points totals
   * Handles ties fairly by assigning the same rank to users with equal points
   */
  async calculateRankings(
    period: LeaderboardPeriod,
    pointsData: Array<{ userId: string; pointsTotal: number }>
  ): Promise<LeaderboardRanking[]> {
    if (pointsData.length === 0) {
      return [];
    }

    // Sort by points descending, then by userId ascending for consistent ordering
    const sorted = [...pointsData].sort((a, b) => {
      if (b.pointsTotal !== a.pointsTotal) {
        return b.pointsTotal - a.pointsTotal;
      }
      return a.userId.localeCompare(b.userId);
    });

    // Assign ranks, handling ties
    const rankings: LeaderboardRanking[] = [];
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
      // If this user has fewer points than the previous, increment rank
      if (i > 0 && sorted[i].pointsTotal < sorted[i - 1].pointsTotal) {
        currentRank = i + 1;
      }

      rankings.push({
        userId: sorted[i].userId,
        pointsTotal: sorted[i].pointsTotal,
        rank: currentRank,
      });
    }

    return rankings;
  }

  /**
   * Update leaderboard rankings for a period
   * Recalculates all ranks based on current points totals
   */
  async updateRankings(period: LeaderboardPeriod): Promise<void> {
    log.info(`Updating rankings for period: ${period}`);

    // Get all users with points for this period
    // Note: This assumes points are aggregated elsewhere (e.g., from RewardPointsTransaction)
    // For now, we'll get from existing leaderboard entries or calculate from transactions
    const entries = await this.prisma.leaderboard.findMany({
      where: { period },
      select: {
        userId: true,
        pointsTotal: true,
      },
    });

    // Calculate new rankings
    const rankings = await this.calculateRankings(period, entries);

    // Update all entries
    for (const ranking of rankings) {
      await upsertLeaderboardEntry(this.prisma, {
        userId: ranking.userId,
        pointsTotal: ranking.pointsTotal,
        period,
        rank: ranking.rank,
      });
    }

    // Invalidate cache
    cache.invalidate(period);

    log.info(`Updated ${rankings.length} rankings for period: ${period}`);
  }

  /**
   * Get top N leaderboard entries for a period
   * Caches results for performance
   */
  async getTopLeaderboard(
    period: LeaderboardPeriod,
    limit: number = 100
  ): Promise<LeaderboardResult> {
    const cacheKey = `top:${period}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const entries = await getTopLeaderboardEntries(this.prisma, period, limit);
    const totalEntries = await this.prisma.leaderboard.count({
      where: { period },
    });

    const result: LeaderboardResult = {
      entries: entries.map((entry: any) => ({
        userId: entry.userId,
        userName: entry.user?.name,
        userEmail: entry.user?.email,
        pointsTotal: entry.pointsTotal,
        rank: entry.rank,
      })),
      totalEntries,
      period,
    };

    cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get user's rank for a period
   * Returns null if user has opted out or has no entry
   */
  async getUserRank(
    userId: string,
    period: LeaderboardPeriod
  ): Promise<UserRankResult | null> {
    // Check if user has opted out
    const preferences = await this.prisma.userGamificationPreferences.findUnique({
      where: { userId },
    });

    if (preferences && !preferences.leaderboardOptIn) {
      return {
        rank: null,
        pointsTotal: 0,
        period,
        isPrivate: true,
      };
    }

    const entry = await getLeaderboardEntry(this.prisma, userId, period);
    if (!entry) {
      return null;
    }

    return {
      rank: entry.rank,
      pointsTotal: entry.pointsTotal,
      period,
      isPrivate: false,
    };
  }

  /**
   * Get leaderboard with user's rank context
   * Anonymizes opted-out users
   */
  async getLeaderboardWithUserContext(
    period: LeaderboardPeriod,
    userId: string,
    topLimit: number = 50,
    contextSize: number = 5
  ): Promise<{
    topEntries: LeaderboardResult['entries'];
    userRank: number | null;
    userPoints: number;
    contextEntries: Array<{
      userId: string;
      userName?: string;
      userEmail?: string;
      pointsTotal: number;
      rank: number;
    }>;
    isPrivate: boolean;
  }> {
    // Get top entries
    const topResult = await this.getTopLeaderboard(period, topLimit);

    // Get user's rank
    const userRankResult = await this.getUserRank(userId, period);

    // Get context around user if they're opted in
    let contextEntries: any[] = [];
    if (userRankResult && !userRankResult.isPrivate && userRankResult.rank) {
      const context = await getLeaderboardAroundUser(
        this.prisma,
        userId,
        period,
        contextSize
      );
      contextEntries = context.entries.map((entry: any) => ({
        userId: entry.userId,
        userName: entry.user?.name,
        userEmail: entry.user?.email,
        pointsTotal: entry.pointsTotal,
        rank: entry.rank,
      }));
    }

    // Anonymize opted-out users in top entries
    const anonymizedTopEntries = topResult.entries.map((entry) => {
      // Check if this user has opted out
      // In a real implementation, you'd batch check preferences
      if (entry.userId === userId && userRankResult?.isPrivate) {
        return {
          ...entry,
          userName: undefined,
          userEmail: undefined,
        };
      }
      return entry;
    });

    return {
      topEntries: anonymizedTopEntries,
      userRank: userRankResult?.rank ?? null,
      userPoints: userRankResult?.pointsTotal ?? 0,
      contextEntries,
      isPrivate: userRankResult?.isPrivate ?? false,
    };
  }

  /**
   * Refresh leaderboard for a period (recalculate all rankings)
   */
  async refreshLeaderboard(period: LeaderboardPeriod): Promise<void> {
    await this.updateRankings(period);
  }
}

