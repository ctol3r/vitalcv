/**
 * BadgeAssignmentService
 * B247B-GAM-012: Assigns badges to users when criteria are met; supports checking progress and awarding multiple badges; prevents duplicate assignments; emits badgeAwarded events
 */

import { PrismaClient } from '@prisma/client';
import { BadgeModel } from '../models/Badge';
import { AchievementProgressModel, ProgressData } from '../models/AchievementProgress';
import { BadgeDefinitionLoader } from './badgeDefinitionLoader';
import { BadgeCriteriaEvaluator } from './badgeCriteriaEvaluator';
import type { UserActivity } from './badgeCriteriaEvaluator';
import { EventEmitter } from 'events';

export interface BadgeAwardedEvent {
  type: 'badgeAwarded';
  userId: string;
  badgeId: string;
  badgeSlug: string;
  badgeName: string;
  awardedAt: Date;
}

export class BadgeAssignmentService {
  private eventBus: EventEmitter;
  private badgeModel: BadgeModel;
  private progressModel: AchievementProgressModel;
  private definitionLoader: BadgeDefinitionLoader;
  private criteriaEvaluator: BadgeCriteriaEvaluator;

  constructor(
    private prisma: PrismaClient,
    eventBus?: EventEmitter
  ) {
    this.eventBus = eventBus || new EventEmitter();
    this.badgeModel = new BadgeModel(prisma);
    this.progressModel = new AchievementProgressModel(prisma);
    this.definitionLoader = new BadgeDefinitionLoader(prisma);
    this.criteriaEvaluator = new BadgeCriteriaEvaluator();
  }

  /**
   * Check and assign badges for a user based on their activity
   */
  async checkAndAssignBadges(
    userId: string,
    activity: UserActivity
  ): Promise<{ awarded: string[]; updated: string[] }> {
    const awarded: string[] = [];
    const updated: string[] = [];

    // Load all active badge definitions
    const badges = await this.definitionLoader.loadAll();

    for (const badge of badges) {
      // Get or create progress record
      let progress = await this.progressModel.findByUserAndBadge(userId, badge.id);

      if (!progress) {
        // Create initial progress
        progress = await this.progressModel.upsert({
          userId,
          badgeId: badge.id,
          currentProgress: {},
          completed: false,
        });
      }

      // Skip if already completed
      if (progress.completed) {
        continue;
      }

      // Update progress based on activity
      const currentProgress = (progress.currentProgress || {}) as ProgressData;
      const updatedProgress = this.criteriaEvaluator.updateProgress(
        badge.criteria,
        currentProgress,
        activity
      );

      // Evaluate if criteria is met
      const criteriaMet = this.criteriaEvaluator.evaluate(
        badge.criteria,
        activity,
        updatedProgress
      );

      // Update progress record
      await this.progressModel.update(userId, badge.id, {
        currentProgress: updatedProgress,
        completed: criteriaMet,
      });

      updated.push(badge.id);

      // If criteria met, award the badge
      if (criteriaMet) {
        const wasAwarded = await this.awardBadge(userId, badge.id);
        if (wasAwarded) {
          awarded.push(badge.id);
        }
      }
    }

    return { awarded, updated };
  }

  /**
   * Award a badge to a user (prevents duplicates)
   */
  async awardBadge(userId: string, badgeId: string): Promise<boolean> {
    // Check if badge is already awarded
    const existing = await this.prisma.badgeAssignment.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });

    if (existing) {
      return false; // Already awarded
    }

    // Award the badge
    await this.prisma.badgeAssignment.create({
      data: {
        userId,
        badgeId,
        awardedAt: new Date(),
      },
    });

    // Get badge details for event
    const badge = await this.badgeModel.findById(badgeId);
    if (!badge) {
      return false;
    }

    // Emit badgeAwarded event
    const event: BadgeAwardedEvent = {
      type: 'badgeAwarded',
      userId,
      badgeId: badge.id,
      badgeSlug: badge.slug,
      badgeName: badge.name,
      awardedAt: new Date(),
    };

    this.eventBus.emit('badgeAwarded', event);

    return true;
  }

  /**
   * Get user's earned badges
   */
  async getUserBadges(userId: string): Promise<Array<{ badge: any; awardedAt: Date }>> {
    const assignments = await this.prisma.badgeAssignment.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { awardedAt: 'desc' },
    });

    return assignments.map((assignment) => ({
      badge: assignment.badge,
      awardedAt: assignment.awardedAt,
    }));
  }

  /**
   * Get user's progress for all badges
   */
  async getUserProgress(userId: string): Promise<Array<{ badge: any; progress: any; completed: boolean }>> {
    const badges = await this.definitionLoader.loadAll();
    const progressRecords = await this.progressModel.findByUser(userId);

    const progressMap = new Map(
      progressRecords.map((p) => [p.badgeId, p])
    );

    return badges.map((badge) => {
      const progress = progressMap.get(badge.id);
      return {
        badge,
        progress: progress?.currentProgress || {},
        completed: progress?.completed || false,
      };
    });
  }

  /**
   * Get progress for a specific badge
   */
  async getBadgeProgress(userId: string, badgeId: string): Promise<{
    badge: any;
    progress: ProgressData;
    completed: boolean;
    progressPercentage: number;
  } | null> {
    const badge = await this.definitionLoader.loadByIdOrSlug(badgeId);
    if (!badge) {
      return null;
    }

    const progress = await this.progressModel.findByUserAndBadge(userId, badge.id);
    const progressData = (progress?.currentProgress || {}) as ProgressData;

    // Calculate progress percentage
    const progressPercentage = this.criteriaEvaluator.calculateProgress(
      badge.criteria,
      {},
      progressData
    );

    return {
      badge,
      progress: progressData,
      completed: progress?.completed || false,
      progressPercentage,
    };
  }

  /**
   * Manually trigger badge check for a user
   */
  async checkUserBadges(userId: string, activity: UserActivity): Promise<string[]> {
    const result = await this.checkAndAssignBadges(userId, activity);
    return result.awarded;
  }

  /**
   * Get event bus (for external listeners)
   */
  getEventBus(): EventEmitter {
    return this.eventBus;
  }
}

