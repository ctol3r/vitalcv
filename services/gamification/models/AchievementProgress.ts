/**
 * AchievementProgress Model
 * B247B-GAM-015: Tracks user's progress towards badges: id, userId, badgeId, currentProgress (JSON), completed (boolean), updatedAt
 */

import { PrismaClient, AchievementProgress as PrismaAchievementProgress } from '@prisma/client';

export interface ProgressData {
  [key: string]: any;
  points?: number;
  actionCount?: number;
  streakDays?: number;
  lastActionDate?: string;
  metadata?: Record<string, any>;
}

export interface AchievementProgressCreateInput {
  userId: string;
  badgeId: string;
  currentProgress?: ProgressData;
  completed?: boolean;
}

export interface AchievementProgressUpdateInput {
  currentProgress?: ProgressData;
  completed?: boolean;
}

export class AchievementProgressModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update achievement progress
   */
  async upsert(data: AchievementProgressCreateInput): Promise<PrismaAchievementProgress> {
    return this.prisma.achievementProgress.upsert({
      where: {
        userId_badgeId: {
          userId: data.userId,
          badgeId: data.badgeId,
        },
      },
      create: {
        userId: data.userId,
        badgeId: data.badgeId,
        currentProgress: (data.currentProgress || {}) as any,
        completed: data.completed ?? false,
      },
      update: {
        currentProgress: (data.currentProgress || {}) as any,
        completed: data.completed ?? false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get progress by ID
   */
  async findById(id: string): Promise<PrismaAchievementProgress | null> {
    return this.prisma.achievementProgress.findUnique({
      where: { id },
    });
  }

  /**
   * Get progress for a user and badge
   */
  async findByUserAndBadge(
    userId: string,
    badgeId: string
  ): Promise<PrismaAchievementProgress | null> {
    return this.prisma.achievementProgress.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });
  }

  /**
   * Get all progress for a user
   */
  async findByUser(userId: string): Promise<PrismaAchievementProgress[]> {
    return this.prisma.achievementProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get all progress for a badge
   */
  async findByBadge(badgeId: string): Promise<PrismaAchievementProgress[]> {
    return this.prisma.achievementProgress.findMany({
      where: { badgeId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get completed progress for a user
   */
  async findCompletedByUser(userId: string): Promise<PrismaAchievementProgress[]> {
    return this.prisma.achievementProgress.findMany({
      where: {
        userId,
        completed: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Update progress
   */
  async update(
    userId: string,
    badgeId: string,
    data: AchievementProgressUpdateInput
  ): Promise<PrismaAchievementProgress> {
    return this.prisma.achievementProgress.update({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
      data: {
        ...(data.currentProgress !== undefined && {
          currentProgress: data.currentProgress as any,
        }),
        ...(data.completed !== undefined && { completed: data.completed }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete progress
   */
  async delete(userId: string, badgeId: string): Promise<void> {
    await this.prisma.achievementProgress.delete({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });
  }
}

